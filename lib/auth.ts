import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { signInSchema } from "./zod";
import { db } from "./db";
import { users, customers } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword } from "./auth-utils";
import { upsertCustomerFromGoogle } from "./customer-google-upsert";

// --- NextAuth Type Augmentation ---
declare module "next-auth" {
    interface User {
        role: string;
    }
    interface Session {
        user: {
            id: string;
            role: string;
        } & DefaultSession["user"];
    }
    interface JWT {
        role: string;
        id: string;
        /** Epoch ms de la última revalidación del rol contra la base. */
        checkedAt?: number;
    }
}

/** Cada cuánto se recomprueba rol y estado activo del usuario en la base. */
const ROLE_REVALIDATE_MS = 5 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        // Google Sign-In para customers en la web.
        // Si las env vars no están seteadas, NextAuth omite el provider silenciosamente
        // (el botón en /login no aparecería tampoco).
        ...(process.env.GOOGLE_OAUTH_WEB_CLIENT_ID && process.env.GOOGLE_OAUTH_WEB_CLIENT_SECRET
            ? [Google({
                clientId: process.env.GOOGLE_OAUTH_WEB_CLIENT_ID,
                clientSecret: process.env.GOOGLE_OAUTH_WEB_CLIENT_SECRET,
                allowDangerousEmailAccountLinking: true, // permite link a cuenta existente por email
            })]
            : []),
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                try {
                    const { email, password } = await signInSchema.parseAsync(credentials);

                    // 1. Check admin users first
                    const adminResult = await db
                        .select()
                        .from(users)
                        .where(and(eq(users.email, email), eq(users.active, true)))
                        .limit(1);

                    if (adminResult.length > 0) {
                        const user = adminResult[0];
                        const isValid = await verifyPassword(password, user.passwordHash);
                        if (!isValid) return null;
                        return {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role,
                        };
                    }

                    // 2. Check customers
                    const customerResult = await db
                        .select()
                        .from(customers)
                        .where(and(eq(customers.email, email.toLowerCase()), eq(customers.active, true)))
                        .limit(1);

                    if (customerResult.length > 0) {
                        const customer = customerResult[0];
                        const isValid = await verifyPassword(password, customer.passwordHash);
                        if (!isValid) return null;
                        return {
                            id: customer.id,
                            email: customer.email,
                            name: `${customer.firstName} ${customer.lastName}`,
                            role: "customer",
                        };
                    }

                    return null;
                } catch {
                    return null;
                }
            },
        }),
    ],
    // En producción confiamos en el host de la request (custom domain miniveci.cl)
    // en lugar del valor de NEXTAUTH_URL — evita redirects a URLs viejas.
    trustHost: true,
    callbacks: {
        async redirect({ url, baseUrl }) {
            // Siempre clampear al dominio canónico configurado, NUNCA al vercel.app fantasma.
            const canonical = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || baseUrl;
            // Path relativo
            if (url.startsWith("/")) return `${canonical}${url}`;
            // URL absoluta del mismo origen
            try {
                if (new URL(url).origin === canonical) return url;
            } catch { /* malformed */ }
            // Cualquier otra cosa → home canónica
            return canonical;
        },
        async signIn({ user, account, profile }) {
            // Google flow: upsert customer en nuestra DB usando datos del perfil.
            // En credentials, el authorize() ya devolvió el user válido — pasa directo.
            if (account?.provider === "google" && profile?.sub && profile.email) {
                try {
                    const c = await upsertCustomerFromGoogle({
                        googleSub: profile.sub,
                        email: profile.email,
                        name: profile.name ?? user?.name ?? profile.email.split("@")[0],
                        picture: (profile.picture as string | undefined) ?? null,
                    });
                    // Inyectar id/role del customer al objeto user de NextAuth
                    if (user) {
                        user.id = c.id;
                        user.role = "customer";
                        user.name = c.name;
                        user.email = c.email;
                    }
                } catch (err) {
                    console.error("[auth] upsertCustomerFromGoogle failed:", err);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id!;
                token.checkedAt = Date.now();
                return token;
            }

            // Revalidación periódica contra la base. Antes el rol se leía solo al
            // iniciar sesión: desactivar o degradar a un admin en /admin/usuarios
            // no tenía efecto hasta que expirara su JWT (hasta 30 días con un
            // token de admin vivo). Ahora se recomprueba cada REVALIDATE_MS.
            const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
            if (Date.now() - checkedAt < ROLE_REVALIDATE_MS) return token;

            const userId = token.id as string | undefined;
            if (!userId) return token;

            try {
                const admin = await db.query.users.findFirst({
                    where: eq(users.id, userId),
                    columns: { role: true, active: true },
                });
                if (admin) {
                    // Cuenta desactivada → invalidar la sesión.
                    if (!admin.active) return null;
                    token.role = admin.role;
                    token.checkedAt = Date.now();
                    return token;
                }

                const customer = await db.query.customers.findFirst({
                    where: eq(customers.id, userId),
                    columns: { active: true },
                });
                if (!customer || !customer.active) return null;

                token.role = "customer";
                token.checkedAt = Date.now();
                return token;
            } catch (err) {
                // Si la base falla, no cerrar sesiones válidas: conservar el token
                // y reintentar en la siguiente petición.
                console.error("[auth] revalidación de rol falló:", err);
                return token;
            }
        },
        async session({ session, token }) {
            if (token) {
                session.user.role = token.role as string;
                session.user.id = token.id as string;
            }
            return session;
        }
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
        // 7 días en lugar de los 30 por defecto: acota la ventana en que un token
        // robado sigue sirviendo.
        maxAge: 7 * 24 * 60 * 60,
    },
});

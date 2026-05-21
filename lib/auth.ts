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
    }
}

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
    callbacks: {
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
            }
            return token;
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
    },
});

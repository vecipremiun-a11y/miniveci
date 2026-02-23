import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signInSchema } from "./zod";
import { db } from "./db";
import { users } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword } from "./auth-utils";

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
}

declare module "next-auth/jwt" {
    interface JWT {
        role: string;
        id: string;
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                try {
                    const { email, password } = await signInSchema.parseAsync(credentials);

                    // Verify user against database — also check active status
                    const result = await db
                        .select()
                        .from(users)
                        .where(and(eq(users.email, email), eq(users.active, true)))
                        .limit(1);

                    if (result.length === 0) {
                        return null; // User not found or inactive
                    }

                    const user = result[0];

                    const isValidPassword = await verifyPassword(password, user.passwordHash);

                    if (!isValidPassword) {
                        return null;
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                    };
                } catch {
                    return null; // Validation or DB error → treat as failed auth
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id!;
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.role = token.role;
                session.user.id = token.id;
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

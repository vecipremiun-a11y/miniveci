import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Session } from "next-auth";

// Custom error class so API routes can distinguish auth errors from others
export class AuthError extends Error {
    public statusCode: number;
    constructor(message = "UNAUTHORIZED", statusCode = 401) {
        super(message);
        this.name = "AuthError";
        this.statusCode = statusCode;
    }
}

export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export async function getServerSession(): Promise<Session | null> {
    const session = await auth();
    return session;
}

export async function requireAuth(): Promise<Session> {
    const session = await getServerSession();
    if (!session?.user) {
        throw new AuthError("UNAUTHORIZED", 401);
    }
    return session;
}

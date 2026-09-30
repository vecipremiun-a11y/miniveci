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

/** Prefijo del passwordHash de los clientes que se registraron con Google
 *  (lo pone `googleOnlyPasswordSentinel` en customer-google-upsert). */
export const GOOGLE_ONLY_PASSWORD_PREFIX = "GOOGLE_AUTH_NO_PASSWORD:";

export function isGoogleOnlyPassword(hash: string | null | undefined): boolean {
    return Boolean(hash?.startsWith(GOOGLE_ONLY_PASSWORD_PREFIX));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    // bcryptjs lanza "Invalid salt version" con un hash que no es bcrypt (ej. el
    // de las cuentas solo-Google): eso es una contraseña incorrecta, no un 500.
    try {
        return await bcrypt.compare(password, hash);
    } catch {
        return false;
    }
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

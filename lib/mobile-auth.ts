/**
 * Mobile auth: emite y verifica JWT firmados con HS256 (NEXTAUTH_SECRET).
 *
 *   accessToken : 15 min, payload { sub, email, role, iat, exp }
 *   refreshToken: 30 días, payload { sub, type:'refresh', jti, iat, exp }
 *                 + fila en refresh_tokens (jti, user_id, user_type, expires_at, revoked)
 *
 * Helpers:
 *   - issueTokens(user)       → { accessToken, refreshToken, refreshExp }
 *   - verifyAccessToken(jwt)  → payload o lanza
 *   - verifyRefreshToken(jwt) → payload + fila DB (valida no revocado)
 *   - revokeRefreshToken(jti)
 *   - requireUser(req)        → { userId, role, email, userType }
 *   - requireAdmin(req)       → { userId, role, email, userType }
 *   - AuthHttpError → throw para que las rutas devuelvan JSON con status
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { refreshTokens } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const SECRET_RAW = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
if (!SECRET_RAW) {
    // En build no romper — pero las funciones siguientes lanzarán si se invocan sin secret.
    console.warn("[mobile-auth] NEXTAUTH_SECRET / AUTH_SECRET no está definido");
}
const SECRET = new TextEncoder().encode(SECRET_RAW || "dev-insecure-secret-do-not-use-in-prod-please");

const ACCESS_TTL = "15m";
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días

export type UserType = "customer" | "admin";
export type NormalizedRole = "customer" | "admin";

const ADMIN_ROLES = new Set(["owner", "admin", "preparacion", "reparto", "contenido"]);

export function isAdminRole(role?: string | null): boolean {
    return !!role && ADMIN_ROLES.has(role);
}

export function normalizeRole(role?: string | null): NormalizedRole {
    return isAdminRole(role) ? "admin" : "customer";
}

export class AuthHttpError extends Error {
    public status: number;
    public code?: string;
    constructor(status: number, message: string, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

// --- Sign / verify ---

interface AccessPayload extends JWTPayload {
    sub: string;
    email: string;
    role: string;       // rol real (puede ser owner, preparacion, customer, etc.)
    userType: UserType; // de qué tabla viene
}

interface RefreshPayload extends JWTPayload {
    sub: string;
    type: "refresh";
    jti: string;
    userType: UserType;
}

export async function signAccessToken(payload: { userId: string; email: string; role: string; userType: UserType }): Promise<string> {
    return await new SignJWT({
        email: payload.email,
        role: payload.role,
        userType: payload.userType,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(payload.userId)
        .setIssuedAt()
        .setExpirationTime(ACCESS_TTL)
        .sign(SECRET);
}

async function signRefreshToken(userId: string, userType: UserType, jti: string): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    const token = await new SignJWT({ type: "refresh", userType })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime(expiresAt)
        .sign(SECRET);
    return { token, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<AccessPayload> {
    try {
        const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
        if (!payload.sub) throw new Error("missing sub");
        return payload as AccessPayload;
    } catch (err: any) {
        const code = err?.code === "ERR_JWT_EXPIRED" ? "token_expired" : "invalid_token";
        throw new AuthHttpError(401, "Token inválido o expirado", code);
    }
}

async function verifyRefreshTokenJwt(token: string): Promise<RefreshPayload> {
    try {
        const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
        if (!payload.sub || !payload.jti || (payload as any).type !== "refresh") {
            throw new Error("not a refresh token");
        }
        return payload as RefreshPayload;
    } catch (err: any) {
        const code = err?.code === "ERR_JWT_EXPIRED" ? "refresh_expired" : "invalid_refresh";
        throw new AuthHttpError(401, "Refresh token inválido o expirado", code);
    }
}

// --- DB integration de refresh tokens ---

export async function issueTokens(user: { id: string; email: string; role: string; userType: UserType }): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: string }> {
    const accessToken = await signAccessToken({ userId: user.id, email: user.email, role: user.role, userType: user.userType });

    const jti = randomUUID();
    const { token: refreshToken, expiresAt } = await signRefreshToken(user.id, user.userType, jti);

    await db.insert(refreshTokens).values({
        jti,
        userId: user.id,
        userType: user.userType,
        expiresAt: expiresAt.toISOString(),
        revoked: false,
        createdAt: new Date().toISOString(),
    });

    return { accessToken, refreshToken, refreshExpiresAt: expiresAt.toISOString() };
}

export async function verifyRefreshToken(token: string): Promise<{ payload: RefreshPayload; row: typeof refreshTokens.$inferSelect }> {
    const payload = await verifyRefreshTokenJwt(token);
    const row = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.jti, payload.jti!) });
    if (!row) throw new AuthHttpError(401, "Refresh token desconocido", "refresh_unknown");
    if (row.revoked) throw new AuthHttpError(401, "Refresh token revocado", "refresh_revoked");
    if (new Date(row.expiresAt).getTime() < Date.now()) {
        throw new AuthHttpError(401, "Refresh token expirado", "refresh_expired");
    }
    return { payload, row };
}

export async function revokeRefreshToken(jti: string): Promise<void> {
    await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.jti, jti));
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await db.update(refreshTokens).set({ revoked: true }).where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.revoked, false)));
}

// --- Extracción del Bearer ---

export function extractBearer(req: Request): string | null {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth?.toLowerCase().startsWith("bearer ")) return null;
    const t = auth.slice(7).trim();
    return t || null;
}

// --- Helpers para rutas protegidas ---

export interface AuthedUser {
    userId: string;
    email: string;
    role: string;           // rol real (preserva subroles admin)
    userType: UserType;
}

export async function requireUser(req: Request): Promise<AuthedUser> {
    const token = extractBearer(req);
    if (!token) throw new AuthHttpError(401, "Falta el header Authorization", "missing_token");
    const payload = await verifyAccessToken(token);
    return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        userType: payload.userType,
    };
}

export async function requireAdmin(req: Request): Promise<AuthedUser> {
    const user = await requireUser(req);
    if (!isAdminRole(user.role)) {
        throw new AuthHttpError(403, "Acceso solo para administradores", "forbidden");
    }
    return user;
}

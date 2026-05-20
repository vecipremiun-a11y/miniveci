/**
 * Helper de autenticación que soporta dos vías:
 *  1. Cookie de NextAuth (clientes web)
 *  2. Authorization: Bearer <jwt> (app Flutter) — mismo formato que /api/auth/mobile/*
 *
 * Para Bearer JWT delega en `verifyAccessToken` de `lib/mobile-auth.ts`.
 */
import { auth } from "@/lib/auth";
import { verifyAccessToken, extractBearer, isAdminRole as _isAdminRole } from "@/lib/mobile-auth";

export interface BakeryAuthUser {
    id: string;
    role: string;
    email?: string | null;
    name?: string | null;
}

/**
 * Devuelve el usuario autenticado (Bearer JWT o cookie NextAuth) o null.
 */
export async function getBakeryUser(req?: Request): Promise<BakeryAuthUser | null> {
    // 1. Intentar Bearer JWT primero (app Flutter, rápido, sin DB)
    if (req) {
        const token = extractBearer(req);
        if (token) {
            try {
                const payload = await verifyAccessToken(token);
                return {
                    id: payload.sub,
                    role: payload.role,
                    email: payload.email ?? null,
                    name: null,
                };
            } catch {
                // token inválido → cae al siguiente método
            }
        }
    }

    // 2. NextAuth session (cookie de web)
    try {
        const session = await auth();
        if (session?.user?.id) {
            return {
                id: session.user.id,
                role: session.user.role || "customer",
                email: session.user.email ?? null,
                name: session.user.name ?? null,
            };
        }
    } catch { /* ignorar */ }

    return null;
}

export const isAdminRole = _isAdminRole;

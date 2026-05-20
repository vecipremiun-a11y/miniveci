/**
 * Shape unificado del usuario expuesto en la API (móvil + /me).
 * Normaliza customers/users (admin) a un formato común.
 */
import type { customers, users } from "@/lib/db/schema";
import { isAdminRole, normalizeRole } from "@/lib/mobile-auth";

export interface ApiUser {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: "customer" | "admin";
    createdAt: string;
}

export function customerToApiUser(c: typeof customers.$inferSelect): ApiUser {
    return {
        id: c.id,
        name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
        email: c.email,
        phone: c.phone || null,
        role: "customer",
        createdAt: c.createdAt ?? new Date().toISOString(),
    };
}

export function adminToApiUser(u: typeof users.$inferSelect): ApiUser {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: null,
        role: normalizeRole(u.role),
        createdAt: u.createdAt ?? new Date().toISOString(),
    };
}

export { isAdminRole };

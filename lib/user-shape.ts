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

export interface CustomerProfile extends ApiUser {
    firstName: string;
    lastName: string;
    rut: string | null;
    address: string | null;
    comuna: string | null;
    city: string | null;
    addressNotes: string | null;
    avatarUrl: string | null;
}

/** Perfil completo del customer para la pantalla "Mi cuenta" de la app (superset de ApiUser). */
export function customerToProfile(c: typeof customers.$inferSelect): CustomerProfile {
    return {
        ...customerToApiUser(c),
        firstName: c.firstName,
        lastName: c.lastName ?? "",
        rut: c.rut ?? null,
        address: c.address ?? null,
        comuna: c.comuna ?? null,
        city: c.city ?? null,
        addressNotes: c.addressNotes ?? null,
        avatarUrl: c.avatarUrl ?? null,
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

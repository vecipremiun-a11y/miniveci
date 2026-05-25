/**
 * Lógica compartida de upsert de customers vía Google Sign-In.
 *
 * Usada por:
 *  - POST /api/auth/mobile/google (Flutter app)
 *  - NextAuth GoogleProvider (web)
 *
 * Lookup en este orden:
 *  1. Por googleId (ya vinculado antes)
 *  2. Por email (link automático al existente)
 *  3. Crear nuevo customer
 */
import { randomUUID } from "crypto";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { claimUnclaimedOrdersForCustomer, syncCustomerToPosveci } from "@/lib/pos-customer-match";

export interface UpsertCustomerInput {
    googleSub: string;
    email: string;
    name: string;
    picture: string | null;
}

export interface UpsertedCustomer {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    name: string;
    phone: string | null;
    role: "customer";
    avatarUrl: string | null;
    isNew: boolean;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
    const trimmed = fullName.trim();
    if (!trimmed) return { firstName: "Cliente", lastName: "" };
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Sentinel que NUNCA va a verificar como password real con bcrypt.compare.
 * Los customers solo-Google no pueden loguearse con email+password — solo Google.
 * Si después configuran un password (set-password flow futuro), se reemplaza.
 */
function googleOnlyPasswordSentinel(): string {
    return `GOOGLE_AUTH_NO_PASSWORD:${randomUUID()}`;
}

/** Reclama encargos presenciales pendientes (solo DB, rápido → inline) y sincroniza
 * el cliente a POSVECI (round-trip de red → diferido para no bloquear el sign-in).
 * Best-effort: nunca rompe el flujo de Google. */
async function tryClaim(customerId: string): Promise<void> {
    try {
        await claimUnclaimedOrdersForCustomer(customerId);
    } catch (err) {
        console.error(`[CLAIM] google upsert threw para ${customerId}:`, (err as Error).message);
    }
    try {
        after(() => syncCustomerToPosveci(customerId));
    } catch {
        // Fuera de contexto de request: ejecutar inline best-effort.
        await syncCustomerToPosveci(customerId);
    }
}

export async function upsertCustomerFromGoogle(input: UpsertCustomerInput): Promise<UpsertedCustomer> {
    const now = new Date().toISOString();

    // 1. Lookup por googleId
    const byGoogle = await db.query.customers.findFirst({
        where: eq(customers.googleId, input.googleSub),
    });
    if (byGoogle) {
        // Actualizar avatar si no tenía y Google nos da uno
        const update: Record<string, unknown> = { updatedAt: now, emailVerified: true };
        if (!byGoogle.avatarUrl && input.picture) update.avatarUrl = input.picture;
        await db.update(customers).set(update).where(eq(customers.id, byGoogle.id));
        return toUpserted(byGoogle, { avatarUrl: (update.avatarUrl as string | undefined) ?? byGoogle.avatarUrl, isNew: false });
    }

    // 2. Lookup por email (link account al existente)
    const byEmail = await db.query.customers.findFirst({
        where: eq(customers.email, input.email),
    });
    if (byEmail) {
        const update: Record<string, unknown> = {
            googleId: input.googleSub,
            emailVerified: true,
            updatedAt: now,
        };
        if (!byEmail.avatarUrl && input.picture) update.avatarUrl = input.picture;
        await db.update(customers).set(update).where(eq(customers.id, byEmail.id));
        await tryClaim(byEmail.id);
        return toUpserted(byEmail, { avatarUrl: (update.avatarUrl as string | undefined) ?? byEmail.avatarUrl, isNew: false });
    }

    // 3. Crear customer nuevo
    const { firstName, lastName } = splitName(input.name);
    const id = randomUUID();
    await db.insert(customers).values({
        id,
        email: input.email,
        passwordHash: googleOnlyPasswordSentinel(),
        firstName,
        lastName,
        phone: "", // sin teléfono al registrarse con Google; se pide en checkout
        rut: null,
        avatarUrl: input.picture,
        googleId: input.googleSub,
        emailVerified: true,
        active: true,
        createdAt: now,
        updatedAt: now,
    });

    await tryClaim(id);

    return {
        id,
        email: input.email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        phone: null,
        role: "customer",
        avatarUrl: input.picture,
        isNew: true,
    };
}

function toUpserted(
    row: typeof customers.$inferSelect,
    overrides: { avatarUrl: string | null; isNew: boolean },
): UpsertedCustomer {
    return {
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        name: `${row.firstName} ${row.lastName}`.trim(),
        phone: row.phone || null,
        role: "customer",
        avatarUrl: overrides.avatarUrl,
        isNew: overrides.isNew,
    };
}

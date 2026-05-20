import { db } from "@/lib/db";
import { chatConversations, customers } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { publishChatEvent } from "@/lib/chat-live-updates";
import { and, eq, isNull } from "drizzle-orm";

export interface CustomerIdentity {
    kind: "customer";
    customerId: string;
    name: string;
    email: string;
}

export interface GuestIdentity {
    kind: "guest";
    guestId: string;
}

export type ClientIdentity = CustomerIdentity | GuestIdentity;

/**
 * Resuelve la identidad del cliente en una request del widget.
 * Prioriza la sesión de NextAuth (rol "customer"); si no, usa el guestId del header.
 */
export async function resolveClientIdentity(
    req: Request,
    guestIdFromBody?: string | null,
): Promise<ClientIdentity | null> {
    const session = await getServerSession();
    if (session?.user?.id && session.user.role === "customer") {
        const customer = await db.query.customers.findFirst({
            where: eq(customers.id, session.user.id),
        });
        if (customer) {
            return {
                kind: "customer",
                customerId: customer.id,
                name: `${customer.firstName} ${customer.lastName}`.trim(),
                email: customer.email,
            };
        }
    }

    const headerGuestId = req.headers.get("x-chat-guest-id");
    const guestId = (guestIdFromBody || headerGuestId || "").trim();
    if (guestId && guestId.length >= 16 && guestId.length <= 64) {
        return { kind: "guest", guestId };
    }
    return null;
}

/**
 * Devuelve la conversación abierta del cliente, creándola si no existe.
 * Si se crea una nueva, emite el evento `conversation_created` para que
 * el admin la vea en tiempo real sin tener que refrescar.
 */
export async function getOrCreateOpenConversation(
    identity: ClientIdentity,
    extras: { guestName?: string | null; guestEmail?: string | null } = {},
) {
    const now = new Date().toISOString();

    if (identity.kind === "customer") {
        const existing = await db.query.chatConversations.findFirst({
            where: and(
                eq(chatConversations.customerId, identity.customerId),
                eq(chatConversations.status, "open"),
            ),
        });
        if (existing) return existing;
    } else {
        const existing = await db.query.chatConversations.findFirst({
            where: and(
                eq(chatConversations.guestId, identity.guestId),
                isNull(chatConversations.customerId),
                eq(chatConversations.status, "open"),
            ),
        });
        if (existing) return existing;
    }

    const id = crypto.randomUUID();
    const baseData = identity.kind === "customer"
        ? { customerId: identity.customerId, guestId: null }
        : { customerId: null, guestId: identity.guestId };

    await db.insert(chatConversations).values({
        id,
        ...baseData,
        guestName: identity.kind === "guest" ? (extras.guestName ?? null) : null,
        guestEmail: identity.kind === "guest" ? (extras.guestEmail ?? null) : null,
        status: "open",
        unreadCustomer: 0,
        unreadAgent: 0,
        createdAt: now,
        updatedAt: now,
    });

    const created = await db.query.chatConversations.findFirst({
        where: eq(chatConversations.id, id),
    });

    if (created) {
        let customerInfo = null;
        if (identity.kind === "customer") {
            const c = await db.query.customers.findFirst({
                where: eq(customers.id, identity.customerId),
            });
            if (c) {
                customerInfo = {
                    id: c.id,
                    firstName: c.firstName,
                    lastName: c.lastName,
                    email: c.email,
                    phone: c.phone,
                };
            }
        }

        publishChatEvent({
            type: "conversation_created",
            conversationId: created.id,
            conversation: {
                id: created.id,
                customerId: created.customerId,
                guestId: created.guestId,
                guestName: created.guestName,
                guestEmail: created.guestEmail,
                assignedOperatorId: created.assignedOperatorId,
                status: created.status as "open" | "closed",
                lastMessageAt: created.lastMessageAt,
                lastMessagePreview: created.lastMessagePreview,
                unreadCustomer: created.unreadCustomer ?? 0,
                unreadAgent: created.unreadAgent ?? 0,
                createdAt: created.createdAt ?? now,
                customer: customerInfo,
            },
            occurredAt: now,
        });
    }

    return created!;
}

/**
 * Verifica que la identidad sea dueña de la conversación dada.
 */
export function ownsConversation(
    identity: ClientIdentity,
    conversation: { customerId: string | null; guestId: string | null },
): boolean {
    if (identity.kind === "customer") {
        return conversation.customerId === identity.customerId;
    }
    return conversation.guestId === identity.guestId;
}

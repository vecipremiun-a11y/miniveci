import { and, eq, inArray, or, sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import {
    bakeryOrders,
    chatConversations,
    chatMessages,
    chatVisitorSessions,
    customerAddresses,
    customerPaymentMethods,
    customers,
    orders,
    raffleEntries,
    refreshTokens,
    subscriptions,
    userPushTokens,
    users,
} from "@/lib/db/schema";
import { BAKERY_GUEST_USER_ID } from "@/lib/db/schema";
import { publishClientUpsert } from "@/lib/posveci-publisher";

/**
 * Eliminación de cuenta de cliente, a pedido del propio cliente (web o app).
 * Es lo que promete la Política de Privacidad (/politica-privacidad#eliminar-cuenta).
 *
 * Qué hace:
 *  - Borra: la cuenta, direcciones, tokens de notificaciones, sesiones de la app,
 *    medios de pago guardados, membresías terminadas, conversaciones del chat
 *    (con sus adjuntos) y sus registros de visitas.
 *  - Anonimiza (no borra) lo que hay que conservar por obligaciones tributarias y
 *    contables: los pedidos de tienda y los encargos quedan con montos, productos
 *    y fechas, pero sin nombre, correo, teléfono, RUT ni dirección. Igual con sus
 *    números de sorteos, para no romper el sorteo.
 *  - En POSVECI, por la API de clientes (que solo sabe hacer upsert): cambia el
 *    nombre a "Cliente eliminado" y vacía la libreta de direcciones que vino de la
 *    tienda. El correo, teléfono y RUT que POSVECI ya tenga NO se pueden borrar
 *    desde acá: quedan anotados en el log para borrarlos a mano en POSVECI.
 *
 * No se puede eliminar con pedidos, encargos o una membresía en curso: se perdería
 * el contacto para entregar, o Mercado Pago seguiría cobrando.
 */

export class AccountDeletionBlockedError extends Error {
    constructor(message: string, public readonly code: "active_orders" | "active_subscription") {
        super(message);
        this.name = "AccountDeletionBlockedError";
    }
}

const ACTIVE_ORDER_STATUSES = ["new", "confirmed", "paid", "preparing", "ready", "shipped"];
const ACTIVE_BAKERY_STATUSES = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"];

const DELETED_NAME = "Cliente eliminado";

function isBlobUrl(url: string | null | undefined): url is string {
    return Boolean(url && /\.blob\.vercel-storage\.com\//.test(url));
}

export interface AccountDeletionResult {
    ordersAnonymized: number;
    bakeryOrdersAnonymized: number;
    filesDeleted: number;
}

export async function deleteCustomerAccount(customerId: string): Promise<AccountDeletionResult> {
    const customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
    if (!customer) return { ordersAnonymized: 0, bakeryOrdersAnonymized: 0, filesDeleted: 0 };

    // 1. Bloqueos: nada en curso.
    const activeOrder = await db
        .select({ n: orders.orderNumber })
        .from(orders)
        .where(and(eq(orders.customerId, customerId), inArray(orders.status, ACTIVE_ORDER_STATUSES)))
        .limit(1);
    const activeBakery = await db
        .select({ id: bakeryOrders.id })
        .from(bakeryOrders)
        .where(and(eq(bakeryOrders.userId, customerId), inArray(bakeryOrders.status, ACTIVE_BAKERY_STATUSES)))
        .limit(1);
    if (activeOrder.length > 0 || activeBakery.length > 0) {
        throw new AccountDeletionBlockedError(
            "Tienes un pedido o encargo en curso. Podrás eliminar tu cuenta cuando se entregue o se cancele.",
            "active_orders",
        );
    }
    const nowIso = new Date().toISOString();
    const activeSub = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(
            eq(subscriptions.customerId, customerId),
            eq(subscriptions.status, "active"),
            sql`${subscriptions.endDate} > ${nowIso}`,
        ))
        .limit(1);
    if (activeSub.length > 0) {
        throw new AccountDeletionBlockedError(
            "Tienes una membresía activa. Cancélala primero desde “Mi membresía” para que no se te siga cobrando.",
            "active_subscription",
        );
    }

    // 2. Archivos a borrar después (foto de perfil y adjuntos del chat).
    const conversations = await db
        .select({ id: chatConversations.id })
        .from(chatConversations)
        .where(eq(chatConversations.customerId, customerId));
    const conversationIds = conversations.map((c) => c.id);
    const attachments = conversationIds.length
        ? await db
            .select({ url: chatMessages.attachmentUrl })
            .from(chatMessages)
            .where(inArray(chatMessages.conversationId, conversationIds))
        : [];
    const blobUrls = [customer.avatarUrl, ...attachments.map((a) => a.url)].filter(isBlobUrl);

    // Pedidos de invitado con su correo: solo si el correo está verificado (Google),
    // para que nadie anonimice pedidos ajenos registrándose con un correo que no es suyo.
    const email = customer.email.trim().toLowerCase();
    const ordersWhere = customer.emailVerified
        ? or(eq(orders.customerId, customerId), sql`lower(trim(${orders.customerEmail})) = ${email}`)
        : eq(orders.customerId, customerId);

    const anonymizedEmail = `eliminado-${customerId.slice(0, 8)}@miniveci.invalid`;

    // 3. Todo en un batch: se aplica completo o nada.
    const [ordersRes, bakeryRes] = await db.batch([
        db.update(orders)
            .set({
                customerId: null,
                customerName: DELETED_NAME,
                customerEmail: anonymizedEmail,
                customerPhone: null,
                customerRut: null,
                shippingAddress: null,
                shippingNotes: null,
                updatedAt: nowIso,
            })
            .where(ordersWhere),
        db.update(bakeryOrders)
            .set({
                userId: BAKERY_GUEST_USER_ID,
                unclaimed: false,
                guestName: null,
                guestEmail: null,
                guestPhone: null,
                guestRut: null,
                address: null,
                contactPhone: null,
                deliveryDetail: null,
                updatedAt: nowIso,
            })
            .where(eq(bakeryOrders.userId, customerId)),
        db.update(raffleEntries)
            .set({ customerId: null, guestName: null, guestEmail: null, guestPhone: null, guestAddress: null, guestRut: null })
            .where(eq(raffleEntries.customerId, customerId)),
        ...(conversationIds.length
            ? [
                db.delete(chatMessages).where(inArray(chatMessages.conversationId, conversationIds)),
                db.delete(chatConversations).where(inArray(chatConversations.id, conversationIds)),
            ]
            : []),
        db.delete(chatVisitorSessions).where(eq(chatVisitorSessions.customerId, customerId)),
        db.delete(customerAddresses).where(eq(customerAddresses.customerId, customerId)),
        db.delete(userPushTokens).where(eq(userPushTokens.userId, customerId)),
        db.delete(customerPaymentMethods).where(eq(customerPaymentMethods.customerId, customerId)),
        db.delete(subscriptions).where(eq(subscriptions.customerId, customerId)),
        db.delete(refreshTokens).where(and(eq(refreshTokens.userId, customerId), eq(refreshTokens.userType, "customer"))),
        // Un admin que compraba con esta cuenta queda sin cuenta de tienda vinculada.
        db.update(users).set({ customerId: null }).where(eq(users.customerId, customerId)),
        db.delete(customers).where(eq(customers.id, customerId)),
    ] as const);

    const ordersAnonymized = ordersRes.rowsAffected ?? 0;
    const bakeryOrdersAnonymized = bakeryRes.rowsAffected ?? 0;

    // 4. Archivos en Vercel Blob (best-effort: la cuenta ya no existe igual).
    let filesDeleted = 0;
    if (blobUrls.length > 0) {
        try {
            await del(blobUrls);
            filesDeleted = blobUrls.length;
        } catch (err) {
            console.error(`[ACCOUNT_DELETE] no se pudieron borrar ${blobUrls.length} archivo(s):`, (err as Error).message);
        }
    }

    // 5. POSVECI: lo que su API permite (nombre + libreta). Best-effort.
    try {
        await publishClientUpsert({
            externalId: customerId,
            name: DELETED_NAME,
            rut: null,
            phone: null,
            email: null,
            address: null,
            addresses: [],
        });
    } catch (err) {
        console.error("[ACCOUNT_DELETE] POSVECI anonimize falló:", (err as Error).message);
    }

    console.warn(
        `[ACCOUNT_DELETE] cuenta ${customerId.slice(0, 8)}... eliminada (${ordersAnonymized} pedido(s) y ` +
        `${bakeryOrdersAnonymized} encargo(s) anonimizados, ${filesDeleted} archivo(s) borrados). ` +
        `PENDIENTE MANUAL: borrar correo/teléfono/RUT del cliente external_id=${customerId} en POSVECI.`,
    );

    return { ordersAnonymized, bakeryOrdersAnonymized, filesDeleted };
}

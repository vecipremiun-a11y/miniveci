import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { bakeryOrders, bakeryOrderItems, BAKERY_GUEST_USER_ID } from "@/lib/db/schema";
import { and, asc, desc, eq, gt, gte, inArray, lte, not } from "drizzle-orm";
import { generatePublicCode, serializeOrder } from "@/lib/bakery";
import { publishBakeryEvent } from "@/lib/bakery-live-updates";
import { notifyOrderStatusChanged } from "@/lib/fcm";
import {
    BAKERY_STATUSES,
    bakeryPosCreateOrderSchema,
    type BakeryStatus,
} from "@/lib/validations/bakery";
import { ZodError } from "zod";
import {
    matchCustomerFromPos,
    normalizeEmail,
    normalizePhone,
    normalizeRut,
} from "@/lib/pos-customer-match";
import { requirePosCredentials, withPosCors } from "@/lib/pos-auth";

export const dynamic = "force-dynamic";
const MAX_GENERATE_RETRIES = 5;

export async function OPTIONS() {
    return withPosCors(new NextResponse(null, { status: 204 }));
}

/**
 * GET /api/pos/bakery/orders
 *
 * Lista encargos de amasandería para POS Veci.
 * Default: encargos NO terminales (pending/confirmed/preparing/ready) — lo que el panadero necesita ver.
 * Ordenados por scheduledFor ASC (más urgente primero).
 *
 * Query params (todos opcionales):
 *   status=pending,confirmed             Comma-separated. Default: pending,confirmed,preparing,ready
 *   date=YYYY-MM-DD                      Solo encargos para esa fecha (compara contra scheduledFor)
 *   since=ISO                            Solo encargos updatedAt > ese timestamp (para sync incremental)
 *   include_terminal=true                Default false. Si true, no aplica filtro de status default
 *   limit=50                             Default 50, max 200
 *   sort=scheduled_asc|scheduled_desc|created_desc   Default scheduled_asc
 *
 * Respuesta:
 *   { data: SerializedOrder[], count: number, fetchedAt: ISO }
 */
export async function GET(req: NextRequest) {
    const denial = await requirePosCredentials(req);
    if (denial) return denial;

    try {
        const { searchParams } = new URL(req.url);
        const statusParam = searchParams.get("status");
        const dateParam = searchParams.get("date");
        const since = searchParams.get("since");
        const includeTerminal = searchParams.get("include_terminal") === "true";
        const limitRaw = parseInt(searchParams.get("limit") || "50", 10) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const sort = searchParams.get("sort") || "scheduled_asc";

        const conditions: any[] = [];

        // Status filter: explicit > default-active
        if (statusParam) {
            const requested = statusParam
                .split(",")
                .map((s) => s.trim())
                .filter((s) => (BAKERY_STATUSES as readonly string[]).includes(s)) as BakeryStatus[];
            if (requested.length === 1) {
                conditions.push(eq(bakeryOrders.status, requested[0]));
            } else if (requested.length > 1) {
                conditions.push(inArray(bakeryOrders.status, requested));
            }
        } else if (!includeTerminal) {
            // Default: ocultar terminales (delivered, cancelled) para optimizar pantalla del panadero
            conditions.push(not(inArray(bakeryOrders.status, ["delivered", "cancelled"])));
        }

        // Date filter: solo encargos cuya fecha de retiro caiga en ese día
        if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            const start = new Date(`${dateParam}T00:00:00`);
            const end = new Date(`${dateParam}T23:59:59.999`);
            conditions.push(gte(bakeryOrders.scheduledFor, start.toISOString()));
            conditions.push(lte(bakeryOrders.scheduledFor, end.toISOString()));
        }

        // Since: para sync incremental, devuelve encargos actualizados después de este timestamp
        if (since) {
            conditions.push(gt(bakeryOrders.updatedAt, since));
        }

        const orderBy =
            sort === "created_desc" ? desc(bakeryOrders.createdAt) :
            sort === "scheduled_desc" ? desc(bakeryOrders.scheduledFor) :
            asc(bakeryOrders.scheduledFor);

        const rows = await db
            .select()
            .from(bakeryOrders)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(orderBy)
            .limit(limit);

        const orderIds = rows.map((o) => o.id);
        const items = orderIds.length > 0
            ? await db.select().from(bakeryOrderItems).where(inArray(bakeryOrderItems.orderId, orderIds))
            : [];
        const itemsByOrder = new Map<string, typeof items>();
        for (const it of items) {
            const arr = itemsByOrder.get(it.orderId) ?? [];
            arr.push(it);
            itemsByOrder.set(it.orderId, arr);
        }

        const data = rows.map((o) => serializeOrder(o, itemsByOrder.get(o.id) ?? []));

        return withPosCors(NextResponse.json({
            data,
            count: data.length,
            fetchedAt: new Date().toISOString(),
        }));
    } catch (error) {
        console.error("[POS_BAKERY_ORDERS_GET]", error);
        return withPosCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
    }
}

/**
 * POST /api/pos/bakery/orders
 *
 * Recibe un encargo presencial creado en POSVECI (cajero atiende al cliente físicamente)
 * y lo refleja en la cuenta web/app del cliente. Contrato definido por POSVECI:
 *
 *   - Idempotente vía `external_order_id` (formato `posveci_{preorder_id}`).
 *     Si llega el mismo dos veces → devuelve el mismo `public_code` con `duplicate: true`.
 *   - Match de cliente por external_id → rut → email → phone (sin matchear por nombre).
 *   - Si no hay match: guest order (userId='__guest__'), claim diferido cuando el
 *     cliente luego se registra / agrega un identificador.
 *   - NO valida `scheduled_for` contra slots web (presencial: el cajero ya acordó la hora).
 *   - NO recalcula precios: guarda snapshot crudo del POS. El cajero ya cobró/acordó.
 *
 * Auth: mismas credenciales POS que el resto (x-api-key/secret).
 */
export async function POST(req: NextRequest) {
    const denial = await requirePosCredentials(req);
    if (denial) return denial;

    try {
        const rawBody = await req.json().catch(() => ({}));
        const data = bakeryPosCreateOrderSchema.parse(rawBody);

        // 1. Idempotencia: si ya existe el external_order_id, devolver el mismo public_code
        const existing = await db.query.bakeryOrders.findFirst({
            where: eq(bakeryOrders.externalOrderId, data.external_order_id),
            columns: { publicCode: true, userId: true },
        });
        if (existing) {
            const existingCustomerId = existing.userId === BAKERY_GUEST_USER_ID ? null : existing.userId;
            return withPosCors(NextResponse.json({
                success: true,
                public_code: existing.publicCode,
                customer_id: existingCustomerId,
                external_order_id: data.external_order_id,
                duplicate: true,
            }, { status: 200 }));
        }

        // 2. Match de cliente (no crea cuentas: si no hay match → guest order)
        const matched = await matchCustomerFromPos({
            externalId: data.client.external_id,
            rut: data.client.rut,
            phone: data.client.phone,
            email: data.client.email,
        });

        const isGuest = !matched;
        const userId = matched?.customerId ?? BAKERY_GUEST_USER_ID;

        // 3. Generar public_code único
        let publicCode = generatePublicCode();
        for (let i = 0; i < MAX_GENERATE_RETRIES; i++) {
            const clash = await db.query.bakeryOrders.findFirst({
                where: eq(bakeryOrders.publicCode, publicCode),
                columns: { id: true },
            });
            if (!clash) break;
            publicCode = generatePublicCode();
        }

        const orderId = `ord_${randomUUID().slice(0, 12)}`;
        const now = new Date().toISOString();
        const contactPhone = data.client.phone?.trim() || null;

        // 4. Insertar order + items con snapshot crudo del POS (no recalculamos)
        await db.insert(bakeryOrders).values({
            id: orderId,
            publicCode,
            userId,
            scheduledFor: data.scheduled_for,
            method: data.method,
            address: data.method === "delivery" ? (data.address?.trim() ?? null) : null,
            generalNotes: data.general_notes?.trim() || null,
            status: "pending",
            subtotal: data.subtotal,
            deliveryFee: data.delivery_fee,
            total: data.total,
            contactPhone,
            externalOrderId: data.external_order_id,
            source: data.source || "posveci_presencial",
            paymentMethod: data.payment_method?.trim() || null,
            deposit: data.deposit,
            unclaimed: isGuest,
            // Solo guardamos guest_* si es guest order: para claim posterior.
            // Si ya hubo match, esos identificadores ya están en la fila de customers.
            guestRut: isGuest ? normalizeRut(data.client.rut) : null,
            guestEmail: isGuest ? normalizeEmail(data.client.email) : null,
            guestPhone: isGuest ? normalizePhone(data.client.phone) : null,
            guestName: isGuest ? (data.client.name?.trim() || null) : null,
            createdAt: now,
            updatedAt: now,
        });

        // Items: usamos product_external_id como productId (cumple con el NOT NULL del schema).
        // No validamos contra bakery_products: el POS puede tener productos que miniveci no.
        const itemsToInsert = data.items.map((it) => ({
            id: randomUUID(),
            orderId,
            productId: it.product_external_id?.trim() || `pos_${randomUUID().slice(0, 8)}`,
            productName: it.product_name,
            pricingMode: it.pricing_mode,
            unitPrice: it.unit_price,
            gramsPerUnit: it.grams_per_unit ?? null,
            // quantity en schema es integer; redondeamos defensivo.
            quantity: Math.round(it.quantity),
            notes: it.note?.trim() || null,
            subtotal: it.line_subtotal,
        }));
        await db.insert(bakeryOrderItems).values(itemsToInsert);

        // 5. SSE para admin/encargos (siempre, aunque sea guest — el panadero quiere verlo)
        const serialized = serializeOrder(
            {
                id: orderId,
                publicCode,
                userId,
                scheduledFor: data.scheduled_for,
                method: data.method,
                address: data.method === "delivery" ? (data.address?.trim() ?? null) : null,
                generalNotes: data.general_notes?.trim() || null,
                status: "pending",
                subtotal: data.subtotal,
                deliveryFee: data.delivery_fee,
                total: data.total,
                contactPhone,
                createdAt: now,
                updatedAt: now,
            },
            itemsToInsert,
        );
        publishBakeryEvent({
            type: "order.created",
            order: serialized,
            occurredAt: now,
        });

        // 6. FCM al cliente (solo si hay match — guests no tienen device token registrado)
        if (!isGuest) {
            after(async () => {
                try {
                    await notifyOrderStatusChanged({
                        userId,
                        status: "pending",
                        source: "bakery",
                        publicCode,
                        orderId,
                    });
                } catch (err) {
                    console.error(`[FCM] notify threw para ${publicCode}:`, (err as Error).message);
                }
            });
        }

        console.log(
            `[POS_BAKERY_ORDER_CREATED] ${publicCode} ext=${data.external_order_id} ` +
            `${isGuest ? "guest" : `matched(${matched.matchedBy})`}`,
        );

        return withPosCors(NextResponse.json({
            success: true,
            public_code: publicCode,
            // ID maestro de la cuenta miniveci — POSVECI lo guarda para enlace permanente.
            // null en guest orders (aún sin cuenta); se enlaza al reclamarse.
            customer_id: isGuest ? null : userId,
            external_order_id: data.external_order_id,
            duplicate: false,
            unclaimed: isGuest,
        }, { status: 201 }));
    } catch (error) {
        if (error instanceof ZodError) {
            const issue = error.issues[0];
            const path = issue?.path?.join(".") || "";
            const msg = issue?.message || "Datos inválidos";
            return withPosCors(NextResponse.json({
                success: false,
                error: path ? `${path}: ${msg}` : msg,
                details: error.issues,
            }, { status: 400 }));
        }
        console.error("[POS_BAKERY_ORDERS_POST]", error);
        return withPosCors(NextResponse.json({
            success: false,
            error: "Internal error",
        }, { status: 500 }));
    }
}

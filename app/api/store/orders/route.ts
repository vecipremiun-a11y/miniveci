import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, orderStatusHistory, products, customers } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { ZodError } from "zod";
import {
    extractRaffleItems, isRaffleItemId, linkRaffleEntriesToOrder,
} from "@/lib/raffle-checkout";
import { extractBearer, verifyAccessToken, AuthHttpError } from "@/lib/mobile-auth";
import { generatePublicCode } from "@/lib/bakery";
import { storeMobileOrderSchema } from "@/lib/validations/store-mobile";
import { publishStoreOrderEvent, type SerializedStoreOrder } from "@/lib/store-live-updates";
import { notifyOrderStatusChanged } from "@/lib/fcm";

// Costo de envío hardcoded. TODO: mover a una tabla settings/config (igual que bakery_config).
const STORE_DELIVERY_FEE_CLP = 1990;

/** Genera order_number antiguo (web checkout legacy). */
function generateLegacyOrderNumber() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `MV-${y}${m}${d}-${rand}`;
}

const MAX_GENERATE_RETRIES = 5;

export async function POST(req: NextRequest) {
    // Si trae Bearer → app móvil con el nuevo contrato.
    // Si no → seguir flujo web legacy intacto.
    const bearer = extractBearer(req);
    if (bearer) return handleMobileOrder(req, bearer);
    return handleLegacyWebOrder(req);
}

// ============================================================
// GET /api/store/orders — listado de pedidos del usuario autenticado (Flutter)
// Requiere Bearer JWT. Filtra por customerId = userId del token.
// ============================================================

export async function GET(req: NextRequest) {
    try {
        const token = extractBearer(req);
        if (!token) {
            return NextResponse.json({ message: "Falta el header Authorization", code: "missing_token" }, { status: 401 });
        }

        let userId: string;
        try {
            const payload = await verifyAccessToken(token);
            userId = payload.sub;
        } catch (err) {
            if (err instanceof AuthHttpError) {
                return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
            }
            return NextResponse.json({ message: "Token inválido", code: "invalid_token" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const statusParam = searchParams.get("status");
        const limitRaw = parseInt(searchParams.get("limit") || "20", 10) || 20;
        const limit = Math.min(Math.max(limitRaw, 1), 100);
        const cursor = searchParams.get("cursor"); // createdAt ISO

        const conditions = [eq(orders.customerId, userId)];
        if (statusParam) {
            const requested = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
            if (requested.length === 1) {
                conditions.push(eq(orders.status, requested[0]));
            } else if (requested.length > 1) {
                conditions.push(inArray(orders.status, requested));
            }
        }
        if (cursor) conditions.push(lt(orders.createdAt, cursor));

        const rows = await db
            .select()
            .from(orders)
            .where(and(...conditions))
            .orderBy(desc(orders.createdAt))
            .limit(limit + 1);

        const hasMore = rows.length > limit;
        const slice = hasMore ? rows.slice(0, limit) : rows;
        const orderIds = slice.map((o) => o.id);

        const itemRows = orderIds.length > 0
            ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
            : [];

        type OrderItemRow = typeof itemRows[number];
        const itemsByOrder = new Map<string, OrderItemRow[]>();
        for (const it of itemRows) {
            const key = it.orderId ?? "";
            const arr = itemsByOrder.get(key) ?? [];
            arr.push(it);
            itemsByOrder.set(key, arr);
        }

        const serialized: SerializedStoreOrder[] = slice.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerId: o.customerId,
            customerName: o.customerName,
            customerEmail: o.customerEmail,
            customerPhone: o.customerPhone,
            method: o.deliveryType === "pickup" ? "pickup" : "delivery",
            address: o.shippingAddress,
            shippingNotes: o.shippingNotes,
            status: o.status ?? "new",
            paymentMethod: o.paymentMethod ?? "",
            paymentStatus: o.paymentStatus ?? "pending",
            subtotal: o.subtotal,
            shippingCost: o.shippingCost ?? 0,
            total: o.total,
            items: (itemsByOrder.get(o.id) ?? []).map((it) => ({
                id: it.id,
                productId: it.productId,
                productName: it.productName,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                totalPrice: it.totalPrice,
            })),
            createdAt: o.createdAt ?? "",
        }));

        const nextCursor = hasMore && slice.length > 0
            ? slice[slice.length - 1].createdAt
            : null;

        return NextResponse.json({ orders: serialized, nextCursor });
    } catch (error) {
        console.error("[STORE_ORDERS_MOBILE_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

// ============================================================
// MOBILE FLOW (Flutter app) — Bearer JWT, server-side authority
// ============================================================

async function handleMobileOrder(req: NextRequest, token: string) {
    try {
        // 1. Verificar JWT
        let userId: string;
        let userType: "customer" | "admin" = "customer";
        try {
            const payload = await verifyAccessToken(token);
            userId = payload.sub;
            userType = (payload.userType as "customer" | "admin") ?? "customer";
        } catch (err) {
            if (err instanceof AuthHttpError) {
                return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
            }
            return NextResponse.json({ message: "Token inválido" }, { status: 401 });
        }

        // 2. Buscar info del cliente (nombre, email, etc.) para el snapshot del pedido
        let customerName = "Cliente";
        let customerEmail = "";
        let customerRut: string | null = null;
        let customerPhoneFromDb: string | null = null;
        if (userType === "customer") {
            const c = await db.query.customers.findFirst({ where: eq(customers.id, userId) });
            if (!c) return NextResponse.json({ message: "Cliente no encontrado" }, { status: 404 });
            customerName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email;
            customerEmail = c.email;
            customerRut = c.rut ?? null;
            customerPhoneFromDb = c.phone ?? null;
        }

        // 3. Parsear y validar payload
        const body = await req.json().catch(() => ({}));
        const data = storeMobileOrderSchema.parse(body);

        // 4. Cargar productos referenciados (validar publicados)
        const productIds = data.items.map((i) => i.productId);
        const productRows = await db
            .select()
            .from(products)
            .where(inArray(products.id, productIds));
        const productMap = new Map(productRows.map((p) => [p.id, p]));

        // 5. Calcular subtotales server-side aplicando offer / priceTiers
        const itemsToInsert: Array<{
            id: string;
            orderId: string;
            productId: string;
            productName: string;
            productSku: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            createdAt: string;
        }> = [];
        const concatenatedItemNotes: string[] = [];

        for (const item of data.items) {
            const p = productMap.get(item.productId);
            if (!p) {
                return NextResponse.json({ message: `Producto no disponible: ${item.productId}` }, { status: 400 });
            }
            if (!p.isPublished) {
                return NextResponse.json({ message: `Producto no disponible: ${p.name}` }, { status: 400 });
            }

            // Precio efectivo: tiers > offer > base
            const basePrice = p.webPrice ?? 0;
            const tiers = (p.priceTiers as Array<{ minQty: number; maxQty: number | null; price: number }> | null) ?? [];
            const matchedTier = tiers.find((t) => item.quantity >= t.minQty && (t.maxQty === null || item.quantity <= t.maxQty));
            const offerPrice = p.isOffer && p.offerPrice ? p.offerPrice : null;
            const unitPrice = matchedTier ? matchedTier.price : (offerPrice ?? basePrice);
            const totalPrice = unitPrice * item.quantity;

            if (item.notes && item.notes.trim().length > 0) {
                concatenatedItemNotes.push(`${p.name}: ${item.notes.trim()}`);
            }

            itemsToInsert.push({
                id: randomUUID(),
                orderId: "", // se llena después
                productId: p.id,
                productName: p.name,
                productSku: p.sku ?? p.id,
                quantity: item.quantity,
                unitPrice,
                totalPrice,
                createdAt: "",
            });
        }

        const subtotal = itemsToInsert.reduce((s, it) => s + it.totalPrice, 0);
        const shippingCost = data.method === "delivery" ? STORE_DELIVERY_FEE_CLP : 0;
        const total = subtotal + shippingCost;

        // 6. Generar orderNumber MV-XXXXX único (con reintentos)
        let orderNumber = generatePublicCode();
        for (let i = 0; i < MAX_GENERATE_RETRIES; i++) {
            const exists = await db.query.orders.findFirst({
                where: eq(orders.orderNumber, orderNumber),
                columns: { id: true },
            });
            if (!exists) break;
            orderNumber = generatePublicCode();
        }

        const orderId = randomUUID();
        const now = new Date().toISOString();

        // 7. Construir notas finales (concatena item notes + general notes para que admin las vea)
        const generalNotes = data.notes?.trim() || null;
        const itemNotesBlock = concatenatedItemNotes.length > 0
            ? `Notas por producto:\n${concatenatedItemNotes.join("\n")}`
            : null;
        const shippingNotesFinal = [generalNotes, itemNotesBlock].filter(Boolean).join("\n\n") || null;

        // 8. Insertar order
        await db.insert(orders).values({
            id: orderId,
            orderNumber,
            customerId: userType === "customer" ? userId : null,
            customerName,
            customerEmail,
            customerPhone: data.phone.trim(),
            customerRut,
            shippingAddress: data.method === "delivery" ? (data.address?.trim() ?? null) : null,
            shippingComuna: null,
            shippingCity: null,
            shippingNotes: shippingNotesFinal,
            deliveryType: data.method,
            deliveryDate: null,
            deliveryTimeSlot: null,
            status: "new",
            paymentMethod: data.paymentMethod,
            paymentId: null,
            paymentStatus: "pending",
            subtotal,
            discount: 0,
            shippingCost,
            total,
            internalNotes: null,
            couponCode: null,
            createdAt: now,
            updatedAt: now,
        });

        // 9. Insertar order items
        await db.insert(orderItems).values(
            itemsToInsert.map((it) => ({ ...it, orderId, createdAt: now })),
        );

        // 10. Historia de estado
        await db.insert(orderStatusHistory).values({
            id: randomUUID(),
            orderId,
            status: "new",
            changedBy: "system",
            notes: "Pedido creado desde la app móvil",
            createdAt: now,
        });

        // 11. Serializar respuesta
        const serialized: SerializedStoreOrder = {
            id: orderId,
            orderNumber,
            customerId: userType === "customer" ? userId : null,
            customerName,
            customerEmail,
            customerPhone: data.phone.trim(),
            method: data.method,
            address: data.method === "delivery" ? (data.address?.trim() ?? null) : null,
            shippingNotes: shippingNotesFinal,
            status: "new",
            paymentMethod: data.paymentMethod,
            paymentStatus: "pending",
            subtotal,
            shippingCost,
            total,
            items: itemsToInsert.map((it) => ({
                id: it.id,
                productId: it.productId,
                productName: it.productName,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                totalPrice: it.totalPrice,
            })),
            createdAt: now,
            source: "mobile",
        };

        // 12. Publicar SSE para admin
        publishStoreOrderEvent({ type: "order.created", order: serialized, occurredAt: now });

        // 13. Push FCM al cliente: "Recibimos tu pedido" — background after response
        if (userType === "customer") {
            after(async () => {
                try {
                    await notifyOrderStatusChanged({
                        userId,
                        status: "new",
                        source: "store",
                        publicCode: orderNumber,
                        orderId,
                    });
                } catch (err) {
                    console.error(`[FCM] notify threw para ${orderNumber}:`, (err as Error).message);
                }
            });
        }

        return NextResponse.json(serialized, { status: 201 });
    } catch (error: any) {
        if (error instanceof ZodError) {
            const issue = error.issues[0];
            const path = issue?.path?.join(".") || "";
            const msg = issue?.message || "Datos inválidos";
            return NextResponse.json({
                message: path ? `Invalid input at "${path}": ${msg}` : msg,
                details: error.issues,
            }, { status: 400 });
        }
        console.error("[STORE_ORDERS_MOBILE_POST]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

// ============================================================
// LEGACY WEB FLOW — sin Bearer; el cliente envía total ya calculado
// (preservado intacto para no romper /checkout actual)
// ============================================================

async function handleLegacyWebOrder(req: NextRequest) {
    try {
        const body = await req.json();

        const {
            customerName,
            customerLastName,
            customerEmail,
            customerPhone,
            customerRut,
            customerId,
            deliveryType,
            deliveryDate,
            deliveryTimeSlot,
            shippingAddress,
            shippingComuna,
            shippingCity,
            shippingNotes,
            paymentMethod,
            paymentId,
            couponCode,
            subtotal,
            discount,
            shippingCost,
            total,
            items: cartItems,
        } = body;

        if (!customerName || !customerEmail) {
            return NextResponse.json({ error: "Nombre y email son requeridos" }, { status: 400 });
        }
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
        }
        if (typeof total !== "number" || total < 0) {
            return NextResponse.json({ error: "Total inválido" }, { status: 400 });
        }

        const orderId = randomUUID();
        const orderNumber = generateLegacyOrderNumber();
        const now = new Date().toISOString();

        const fullName = customerLastName
            ? `${customerName} ${customerLastName}`
            : customerName;

        const paymentStatus = paymentMethod === "contrarembolso" ? "pending" : "pending";

        await db.insert(orders).values({
            id: orderId,
            orderNumber,
            customerId: customerId || null,
            customerName: fullName,
            customerEmail,
            customerPhone: customerPhone || null,
            customerRut: customerRut || null,
            shippingAddress: shippingAddress || null,
            shippingComuna: shippingComuna || null,
            shippingCity: shippingCity || null,
            shippingNotes: shippingNotes || null,
            deliveryType: deliveryType || "delivery",
            deliveryDate: deliveryDate || null,
            deliveryTimeSlot: deliveryTimeSlot || null,
            status: "new",
            paymentMethod: paymentMethod || "contrarembolso",
            paymentId: paymentId || null,
            paymentStatus,
            subtotal,
            discount: discount || 0,
            shippingCost: shippingCost || 0,
            total,
            couponCode: couponCode || null,
            createdAt: now,
            updatedAt: now,
        });

        const insertedItems: Array<{ id: string; productId: string | null; productName: string; quantity: number; unitPrice: number; totalPrice: number }> = [];
        for (const item of cartItems) {
            const isRaffle = isRaffleItemId(item.id);
            const itemId = randomUUID();
            await db.insert(orderItems).values({
                id: itemId,
                orderId,
                productId: isRaffle ? null : (item.id || null),
                productName: item.name,
                productSku: item.sku || item.id || "",
                quantity: item.quantity,
                unitPrice: item.price,
                totalPrice: item.price * item.quantity,
                createdAt: now,
            });
            insertedItems.push({
                id: itemId,
                productId: isRaffle ? null : (item.id || null),
                productName: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                totalPrice: item.price * item.quantity,
            });
        }

        if (customerId) {
            const raffleItems = extractRaffleItems(cartItems);
            if (raffleItems.length > 0) {
                await linkRaffleEntriesToOrder(orderId, customerId, raffleItems);
            }
        }

        await db.insert(orderStatusHistory).values({
            id: randomUUID(),
            orderId,
            status: "new",
            changedBy: "system",
            notes: "Pedido creado desde la tienda web",
            createdAt: now,
        });

        // También publica SSE para el admin (igual que el flujo móvil)
        const serialized: SerializedStoreOrder = {
            id: orderId,
            orderNumber,
            customerId: customerId || null,
            customerName: fullName,
            customerEmail,
            customerPhone: customerPhone || null,
            method: (deliveryType === "pickup" ? "pickup" : "delivery"),
            address: shippingAddress || null,
            shippingNotes: shippingNotes || null,
            status: "new",
            paymentMethod: paymentMethod || "contrarembolso",
            paymentStatus,
            subtotal: subtotal ?? 0,
            shippingCost: shippingCost ?? 0,
            total: total ?? 0,
            items: insertedItems,
            createdAt: now,
            source: "web",
        };
        publishStoreOrderEvent({ type: "order.created", order: serialized, occurredAt: now });

        // Push FCM si el cliente está identificado (logueado web) — background after response
        if (customerId) {
            after(async () => {
                try {
                    await notifyOrderStatusChanged({
                        userId: customerId,
                        status: "new",
                        source: "store",
                        publicCode: orderNumber,
                        orderId,
                    });
                } catch (err) {
                    console.error(`[FCM] notify threw para ${orderNumber}:`, (err as Error).message);
                }
            });
        }

        return NextResponse.json({
            success: true,
            orderId,
            orderNumber,
        }, { status: 201 });

    } catch (error) {
        console.error("[STORE_ORDER_CREATE]", error);
        return NextResponse.json(
            { error: "Error al crear el pedido" },
            { status: 500 }
        );
    }
}

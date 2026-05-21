import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { bakeryOrders, bakeryOrderItems, bakeryProducts, customers } from "@/lib/db/schema";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { getBakeryUser } from "@/lib/bakery-auth";
import {
    calcItemSubtotal,
    generatePublicCode,
    loadBakeryConfig,
    serializeOrder,
    validateScheduledFor,
} from "@/lib/bakery";
import { publishBakeryEvent } from "@/lib/bakery-live-updates";
import { publishPreorderCreated } from "@/lib/posveci-publisher";
import { notifyOrderStatusChanged } from "@/lib/fcm";
import { bakeryCreateOrderSchema } from "@/lib/validations/bakery";
import { ZodError } from "zod";

const MAX_GENERATE_RETRIES = 5;

export async function POST(req: NextRequest) {
    try {
        const user = await getBakeryUser(req);
        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const data = bakeryCreateOrderSchema.parse(body);

        // 1. Cargar config y validar fecha/hora
        const cfg = await loadBakeryConfig();
        const dateCheck = validateScheduledFor(data.scheduledFor, cfg);
        if (!dateCheck.ok) {
            return NextResponse.json({ message: dateCheck.reason }, { status: 400 });
        }

        // 2. Validar delivery offered
        if (data.method === "delivery" && !cfg.offersDelivery) {
            return NextResponse.json({ message: "Delivery no disponible" }, { status: 400 });
        }

        // 3. Cargar productos referenciados y validar activos
        const productIds = data.items.map((i) => i.productId);
        const products = await db
            .select()
            .from(bakeryProducts)
            .where(and(inArray(bakeryProducts.id, productIds), eq(bakeryProducts.active, true)));
        const productMap = new Map(products.map((p) => [p.id, p]));

        for (const item of data.items) {
            if (!productMap.has(item.productId)) {
                return NextResponse.json({ message: `Producto no disponible: ${item.productId}` }, { status: 400 });
            }
        }

        // 4. Calcular subtotales server-side (autoridad final)
        const itemsToInsert = data.items.map((item) => {
            const p = productMap.get(item.productId)!;
            const subtotal = calcItemSubtotal(
                { pricingMode: p.pricingMode as "unit" | "kg", price: p.price, gramsPerUnit: p.gramsPerUnit },
                item.quantity,
            );
            return {
                id: randomUUID(),
                productId: p.id,
                productName: p.name,
                pricingMode: p.pricingMode,
                unitPrice: p.price,
                gramsPerUnit: p.gramsPerUnit,
                quantity: item.quantity,
                notes: item.notes?.trim() || null,
                subtotal,
            };
        });

        const subtotal = itemsToInsert.reduce((s, it) => s + it.subtotal, 0);
        const deliveryFee = data.method === "delivery" ? cfg.deliveryFee : 0;
        const total = subtotal + deliveryFee;

        // 5. Snapshot del cliente (si existe en customers)
        let contactPhone: string | null = null;
        let customerSnapshot: { firstName: string; lastName: string; email: string; phone: string; rut: string | null } | null = null;
        try {
            const c = await db.query.customers.findFirst({ where: eq(customers.id, user.id) });
            if (c) {
                contactPhone = c.phone ?? null;
                customerSnapshot = {
                    firstName: c.firstName,
                    lastName: c.lastName,
                    email: c.email,
                    phone: c.phone,
                    rut: c.rut ?? null,
                };
            }
        } catch { /* user puede no estar en customers */ }

        // 6. Generar public_code único (con reintentos)
        let publicCode = generatePublicCode();
        for (let i = 0; i < MAX_GENERATE_RETRIES; i++) {
            const exists = await db.query.bakeryOrders.findFirst({
                where: eq(bakeryOrders.publicCode, publicCode),
                columns: { id: true },
            });
            if (!exists) break;
            publicCode = generatePublicCode();
        }

        const orderId = `ord_${randomUUID().slice(0, 12)}`;
        const now = new Date().toISOString();

        // 7. Insertar orden + items (Turso no soporta transacciones múltiples en libsql client,
        //    pero por su modelo BEGIN/COMMIT funciona en single-statement. Insertamos secuencial.)
        await db.insert(bakeryOrders).values({
            id: orderId,
            publicCode,
            userId: user.id,
            scheduledFor: data.scheduledFor,
            method: data.method,
            address: data.method === "delivery" ? (data.address?.trim() ?? null) : null,
            generalNotes: data.generalNotes?.trim() || null,
            status: "pending",
            subtotal,
            deliveryFee,
            total,
            contactPhone,
            createdAt: now,
            updatedAt: now,
        });

        await db.insert(bakeryOrderItems).values(
            itemsToInsert.map((it) => ({ ...it, orderId })),
        );

        // 8. Serializar respuesta
        const serialized = serializeOrder(
            {
                id: orderId,
                publicCode,
                userId: user.id,
                scheduledFor: data.scheduledFor,
                method: data.method,
                address: data.method === "delivery" ? (data.address?.trim() ?? null) : null,
                generalNotes: data.generalNotes?.trim() || null,
                status: "pending",
                subtotal,
                deliveryFee,
                total,
                contactPhone,
                createdAt: now,
                updatedAt: now,
            },
            itemsToInsert,
        );

        // 9. Publicar evento SSE para admin
        publishBakeryEvent({
            type: "order.created",
            order: serialized,
            occurredAt: now,
        });

        // 10-11. Trabajo en background DESPUÉS de mandar la respuesta.
        // Crítico: en Vercel serverless, `void asyncFn()` muere cuando la lambda
        // se congela post-response. `after()` le dice a Vercel que extienda la
        // lifetime de la lambda lo suficiente para terminar este trabajo.
        // Esto fue la causa de POSTs a POSVECI que no llegaban en prod.
        after(async () => {
            // POSVECI: publica preorder al sistema del panadero
            if (customerSnapshot) {
                const fullName = `${customerSnapshot.firstName} ${customerSnapshot.lastName}`.trim();
                try {
                    await publishPreorderCreated(serialized, {
                        externalId: user.id,
                        name: fullName || customerSnapshot.email,
                        phone: customerSnapshot.phone,
                        email: customerSnapshot.email,
                        rut: customerSnapshot.rut,
                    });
                } catch (err) {
                    console.error(`[POSVECI] publisher threw para ${publicCode}:`, (err as Error).message);
                }
            } else {
                console.warn(`[POSVECI] skip publish para ${publicCode}: user ${user.id.slice(0, 8)}... (role=${user.role}) no está en tabla customers — probablemente es admin testeando. Registra una cuenta de cliente para probar el flujo completo.`);
            }

            // FCM: push "Recibimos tu encargo"
            try {
                await notifyOrderStatusChanged({
                    userId: user.id,
                    status: "pending",
                    source: "bakery",
                    publicCode,
                    orderId,
                });
            } catch (err) {
                console.error(`[FCM] notify threw para ${publicCode}:`, (err as Error).message);
            }
        });

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
        console.error("[BAKERY_ORDERS_POST]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const user = await getBakeryUser(req);
        if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
        const cursor = searchParams.get("cursor"); // createdAt ISO

        const conditions = [eq(bakeryOrders.userId, user.id)];
        if (status) {
            const requested = status.split(",").map((s) => s.trim()).filter(Boolean);
            if (requested.length === 1) {
                conditions.push(eq(bakeryOrders.status, requested[0]));
            } else if (requested.length > 1) {
                conditions.push(inArray(bakeryOrders.status, requested));
            }
        }
        if (cursor) conditions.push(lt(bakeryOrders.createdAt, cursor));

        const orders = await db
            .select()
            .from(bakeryOrders)
            .where(and(...conditions))
            .orderBy(desc(bakeryOrders.createdAt))
            .limit(limit + 1);

        const hasMore = orders.length > limit;
        const slice = hasMore ? orders.slice(0, limit) : orders;
        const orderIds = slice.map((o) => o.id);
        const items = orderIds.length > 0
            ? await db.select().from(bakeryOrderItems).where(inArray(bakeryOrderItems.orderId, orderIds))
            : [];
        const itemsByOrder = new Map<string, typeof items>();
        for (const it of items) {
            const arr = itemsByOrder.get(it.orderId) ?? [];
            arr.push(it);
            itemsByOrder.set(it.orderId, arr);
        }

        const data = slice.map((o) => serializeOrder(o, itemsByOrder.get(o.id) ?? []));
        const nextCursor = hasMore ? slice[slice.length - 1].createdAt : null;

        return NextResponse.json({ orders: data, nextCursor });
    } catch (error) {
        console.error("[BAKERY_ORDERS_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

import { NextRequest, NextResponse, after } from "next/server";
import { getSessionCustomerId } from "@/lib/session-customer";
import { db } from "@/lib/db";
import { orders, orderItems, orderStatusHistory } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { extractRaffleItems, linkRaffleEntriesToOrder } from "@/lib/raffle-checkout";
import { recalcStorePricing } from "@/lib/store-pricing";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { generateUniqueOrderNumber } from "@/lib/order-number";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { persistCheckoutProfile } from "@/lib/checkout-profile";
import { extractBearer, verifyAccessToken } from "@/lib/mobile-auth";
import { createOrderPreference, type MpCheckoutOrigin } from "@/lib/mp-checkout";

export async function POST(req: NextRequest) {
    const limited = enforceRateLimit(req, RATE_LIMITS.checkout);
    if (limited) return limited;

    try {
        const body = await req.json();

        // SEGURIDAD: el dueño del pedido sale de la sesión o del Bearer JWT,
        // NUNCA del body (ver nota equivalente en /api/store/orders).
        //
        // El Bearer es lo que usa la app Flutter (compra de números de sorteo).
        // Sin esta rama customerId quedaba null: el pedido se creaba huérfano y
        // las entries del sorteo nunca se vinculaban ni se confirmaban al pagar.
        const bearer = extractBearer(req);
        let customerId: string | null = null;
        let origin: MpCheckoutOrigin = "web";

        if (bearer) {
            try {
                const payload = await verifyAccessToken(bearer);
                if ((payload.userType ?? "customer") === "customer") {
                    customerId = payload.sub;
                }
                origin = "app";
            } catch {
                return NextResponse.json({ error: "Token inválido", code: "invalid_token" }, { status: 401 });
            }
        } else {
            customerId = await getSessionCustomerId();
        }

        const {
            customerName,
            customerLastName,
            customerEmail: rawCustomerEmail,
            customerPhone,
            customerRut,
            deliveryType,
            deliveryDate,
            deliveryTimeSlot,
            shippingAddress,
            shippingComuna,
            shippingCity,
            shippingNotes,
            couponCode,
            items: cartItems,
        } = body;

        // El correo se guarda siempre en minúscula: "Ana@x.cl" y "ana@x.cl" son la
        // misma casilla, y así el pedido calza con la cuenta (Google lo manda en
        // minúscula) y el listado de clientes no la parte en dos.
        const customerEmail = typeof rawCustomerEmail === "string" ? rawCustomerEmail.trim().toLowerCase() : "";

        if (!customerName || !customerEmail) {
            return NextResponse.json({ error: "Nombre y email son requeridos" }, { status: 400 });
        }
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
        }

        // SEGURIDAD: recalcular precios/subtotal/envío/descuento/total server-side.
        // Nunca confiar en los montos que envía el navegador (price tampering).
        // El precio de suscriptor también se resuelve acá, contra la base.
        const isSubscriber = await hasActiveSubscription(customerId);
        const pricing = await recalcStorePricing(cartItems, { deliveryType, couponCode, isSubscriber });
        if (!pricing.ok) {
            return NextResponse.json({ error: pricing.error || "Carrito inválido" }, { status: 400 });
        }
        const { items: pricedItems, subtotal, discount, shippingCost, total } = pricing;

        // Create order first with status "pending_payment"
        const orderId = randomUUID();
        const orderNumber = await generateUniqueOrderNumber();
        const now = new Date().toISOString();
        const fullName = customerLastName ? `${customerName} ${customerLastName}` : customerName;

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
            paymentMethod: "mercadopago",
            paymentId: null,
            paymentStatus: "pending",
            subtotal,
            discount,
            shippingCost,
            total,
            couponCode: pricing.appliedCoupon,
            createdAt: now,
            updatedAt: now,
        });

        for (const item of pricedItems) {
            await db.insert(orderItems).values({
                id: randomUUID(),
                orderId,
                productId: item.isRaffle ? null : item.id,
                productName: item.name,
                productSku: item.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                createdAt: now,
            });
        }

        // Vincular números de sorteo reservados con esta orden
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
            notes: "Pedido creado - pendiente de pago Mercado Pago",
            createdAt: now,
        });

        // Guarda en el perfil los datos que faltaban para precargar el próximo checkout
        // (mismo criterio que /api/store/orders; la orden ya existe aunque el pago
        // quede pendiente en Mercado Pago).
        if (customerId) {
            after(() => persistCheckoutProfile({
                customerId,
                firstName: customerName,
                lastName: customerLastName,
                phone: customerPhone,
                rut: customerRut,
                deliveryType,
                address: shippingAddress,
                comuna: shippingComuna,
                city: shippingCity,
                addressNotes: shippingNotes,
            }));
        }

        // Create preference (precios ya verificados server-side)
        const preference = await createOrderPreference({
            orderId,
            orderNumber,
            customerName,
            customerLastName,
            customerEmail,
            customerPhone,
            items: pricedItems.map((item) => ({
                title: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            })),
            shippingCost,
            discount,
            origin,
        });

        return NextResponse.json({
            success: true,
            orderId,
            orderNumber,
            preferenceId: preference.preferenceId,
            initPoint: preference.initPoint,
            sandboxInitPoint: preference.sandboxInitPoint,
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("Error creating MP preference:", errMsg, error);
        return NextResponse.json(
            { error: "Error al crear la preferencia de pago" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse, after } from "next/server";
import { mpPreference } from "@/lib/mercadopago";
import { db } from "@/lib/db";
import { orders, orderItems, orderStatusHistory } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { extractRaffleItems, linkRaffleEntriesToOrder } from "@/lib/raffle-checkout";
import { recalcStorePricing } from "@/lib/store-pricing";
import { generateUniqueOrderNumber } from "@/lib/order-number";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { persistCheckoutProfile } from "@/lib/checkout-profile";
import { getSiteUrl } from "@/lib/site-url";

export async function POST(req: NextRequest) {
    const limited = enforceRateLimit(req, RATE_LIMITS.checkout);
    if (limited) return limited;

    try {
        const body = await req.json();

        // SEGURIDAD: el dueño del pedido sale de la sesión, NUNCA del body
        // (ver nota equivalente en /api/store/orders).
        const session = await auth();
        const customerId = session?.user?.role === "customer" ? session.user.id : null;

        const {
            customerName,
            customerLastName,
            customerEmail,
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

        if (!customerName || !customerEmail) {
            return NextResponse.json({ error: "Nombre y email son requeridos" }, { status: 400 });
        }
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
        }

        // SEGURIDAD: recalcular precios/subtotal/envío/descuento/total server-side.
        // Nunca confiar en los montos que envía el navegador (price tampering).
        const pricing = await recalcStorePricing(cartItems, { deliveryType, couponCode });
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

        // Build MP preference items (precios ya verificados server-side)
        const mpItems = pricedItems.map((item) => ({
            id: orderId,
            title: item.name.substring(0, 256),
            quantity: item.quantity,
            unit_price: item.unitPrice,
            currency_id: "CLP" as const,
        }));

        // Add shipping as an item if applicable
        if (shippingCost > 0) {
            mpItems.push({
                id: orderId,
                title: "Envío a domicilio",
                quantity: 1,
                unit_price: shippingCost,
                currency_id: "CLP" as const,
            });
        }

        // Add discount as negative item if applicable
        if (discount > 0) {
            mpItems.push({
                id: orderId,
                title: "Descuento aplicado",
                quantity: 1,
                unit_price: -discount,
                currency_id: "CLP" as const,
            });
        }

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

        const siteUrl = getSiteUrl();
        const isHttps = siteUrl.startsWith("https");

        const backUrls = {
            success: `${siteUrl}/pedido-exitoso?order=${encodeURIComponent(orderNumber)}&source=mp`,
            failure: `${siteUrl}/checkout?error=payment_failed&order=${encodeURIComponent(orderNumber)}`,
            pending: `${siteUrl}/pedido-exitoso?order=${encodeURIComponent(orderNumber)}&source=mp&status=pending`,
        };

        // Create preference
        const preference = await mpPreference.create({
            body: {
                items: mpItems,
                payer: {
                    name: customerName,
                    surname: customerLastName || "",
                    email: customerEmail,
                    phone: customerPhone ? { number: customerPhone } : undefined,
                },
                back_urls: backUrls,
                ...(isHttps ? { auto_return: "approved" as const } : {}),
                external_reference: orderNumber,
                notification_url: isHttps ? `${siteUrl}/api/webhooks/mercadopago` : undefined,
                statement_descriptor: "MINIVECI",
            },
        });

        return NextResponse.json({
            success: true,
            orderId,
            orderNumber,
            preferenceId: preference.id,
            initPoint: preference.init_point,
            sandboxInitPoint: preference.sandbox_init_point,
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

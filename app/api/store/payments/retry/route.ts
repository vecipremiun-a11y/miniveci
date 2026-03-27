import { NextRequest, NextResponse } from "next/server";
import { mpPreference } from "@/lib/mercadopago";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const { orderId } = await req.json();
        if (!orderId) {
            return NextResponse.json({ error: "orderId requerido" }, { status: 400 });
        }

        // Fetch the order
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) {
            return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
        }

        // Verify ownership
        if (order.customerId !== session.user.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        // Only allow retry for pending/unpaid orders
        if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") {
            return NextResponse.json({ error: "Este pedido ya fue pagado" }, { status: 400 });
        }

        // Fetch order items
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

        // Build MP preference items
        const mpItems = items.map((item) => ({
            id: orderId,
            title: item.productName.substring(0, 256),
            quantity: Math.max(1, Math.round(item.quantity)),
            unit_price: item.unitPrice,
            currency_id: "CLP" as const,
        }));

        if ((order.shippingCost || 0) > 0) {
            mpItems.push({
                id: orderId,
                title: "Envío a domicilio",
                quantity: 1,
                unit_price: order.shippingCost!,
                currency_id: "CLP" as const,
            });
        }

        if ((order.discount || 0) > 0) {
            mpItems.push({
                id: orderId,
                title: "Descuento aplicado",
                quantity: 1,
                unit_price: -order.discount!,
                currency_id: "CLP" as const,
            });
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
            || req.headers.get("origin")
            || req.headers.get("referer")?.replace(/\/[^/]*$/, "")
            || "https://www.miniveci.cl";
        const isHttps = siteUrl.startsWith("https");

        const backUrls = {
            success: `${siteUrl}/pedido-exitoso?order=${encodeURIComponent(order.orderNumber)}&source=mp`,
            failure: `${siteUrl}/cuenta/pedidos?id=${orderId}&error=payment_failed`,
            pending: `${siteUrl}/pedido-exitoso?order=${encodeURIComponent(order.orderNumber)}&source=mp&status=pending`,
        };

        const nameParts = (order.customerName || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const preference = await mpPreference.create({
            body: {
                items: mpItems,
                payer: {
                    name: firstName,
                    surname: lastName,
                    email: order.customerEmail || "",
                    phone: order.customerPhone ? { number: order.customerPhone } : undefined,
                },
                back_urls: backUrls,
                ...(isHttps ? { auto_return: "approved" as const } : {}),
                external_reference: order.orderNumber,
                notification_url: isHttps ? `${siteUrl}/api/webhooks/mercadopago` : undefined,
                statement_descriptor: "MINIVECI",
            },
        });

        // Update payment method to mercadopago
        await db.update(orders).set({
            paymentMethod: "mercadopago",
            updatedAt: new Date().toISOString(),
        }).where(eq(orders.id, orderId));

        return NextResponse.json({
            success: true,
            preferenceId: preference.id,
            initPoint: preference.init_point,
            sandboxInitPoint: preference.sandbox_init_point,
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("Error creating retry payment:", errMsg);
        return NextResponse.json(
            { error: "Error al crear el reintento de pago" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const { orderId, paymentMethod, receiptUrl } = await req.json();
        if (!orderId || !paymentMethod) {
            return NextResponse.json({ error: "orderId y paymentMethod requeridos" }, { status: 400 });
        }

        const validMethods = ["contrarembolso", "transferencia"];
        if (!validMethods.includes(paymentMethod)) {
            return NextResponse.json({ error: "Método de pago no válido" }, { status: 400 });
        }

        if (paymentMethod === 'transferencia' && !receiptUrl) {
            return NextResponse.json({ error: "Debes subir el comprobante de transferencia" }, { status: 400 });
        }

        const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) {
            return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
        }

        if (order.customerId !== session.user.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") {
            return NextResponse.json({ error: "Este pedido ya fue pagado" }, { status: 400 });
        }

        const paymentId = paymentMethod === 'transferencia' && receiptUrl
            ? receiptUrl
            : paymentMethod === 'contrarembolso'
                ? 'confirmed'
                : undefined;

        await db.update(orders).set({
            paymentMethod,
            ...(paymentId ? { paymentId } : {}),
            updatedAt: new Date().toISOString(),
        }).where(eq(orders.id, orderId));

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("Error changing payment method:", errMsg);
        return NextResponse.json(
            { error: "Error al cambiar el método de pago" },
            { status: 500 }
        );
    }
}

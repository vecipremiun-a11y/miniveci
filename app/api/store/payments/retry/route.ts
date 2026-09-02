import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractBearer, verifyAccessToken, AuthHttpError } from "@/lib/mobile-auth";
import { createOrderPreference, type MpCheckoutOrigin } from "@/lib/mp-checkout";

export async function POST(req: NextRequest) {
    try {
        // Acepta sesión web (NextAuth) o Bearer JWT de la app móvil, para que
        // "Mis pedidos" en Flutter pueda reintentar el pago de un pedido
        // pendiente igual que la web.
        const bearer = extractBearer(req);
        let userId: string | null = null;
        let origin: MpCheckoutOrigin = "web";

        if (bearer) {
            try {
                const payload = await verifyAccessToken(bearer);
                userId = payload.sub;
                origin = "app";
            } catch (err) {
                if (err instanceof AuthHttpError) {
                    return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
                }
                return NextResponse.json({ message: "Token inválido", code: "invalid_token" }, { status: 401 });
            }
        } else {
            const session = await auth();
            userId = session?.user?.id ?? null;
        }

        if (!userId) {
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
        if (order.customerId !== userId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        // Only allow retry for pending/unpaid orders
        if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") {
            return NextResponse.json({ error: "Este pedido ya fue pagado" }, { status: 400 });
        }

        // Fetch order items
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

        const preference = await createOrderPreference({
            orderId,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            items: items.map((item) => ({
                title: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            })),
            shippingCost: order.shippingCost,
            discount: order.discount,
            origin,
        });

        // Update payment method to mercadopago.
        // Desde la app el pedido se guardó como "mercado_pago" (contrato móvil);
        // no lo pisamos para que la app siga reconociéndolo.
        await db.update(orders).set({
            paymentMethod: origin === "app" ? "mercado_pago" : "mercadopago",
            updatedAt: new Date().toISOString(),
        }).where(eq(orders.id, orderId));

        return NextResponse.json({
            success: true,
            orderId,
            orderNumber: order.orderNumber,
            preferenceId: preference.preferenceId,
            initPoint: preference.initPoint,
            sandboxInitPoint: preference.sandboxInitPoint,
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

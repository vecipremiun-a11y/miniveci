import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, orderStatusHistory } from "@/lib/db/schema";
import { randomUUID } from "crypto";

function generateOrderNumber() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `MV-${y}${m}${d}-${rand}`;
}

export async function POST(req: Request) {
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
            couponCode,
            subtotal,
            discount,
            shippingCost,
            total,
            items: cartItems,
        } = body;

        // Validations
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
        const orderNumber = generateOrderNumber();
        const now = new Date().toISOString();

        const fullName = customerLastName
            ? `${customerName} ${customerLastName}`
            : customerName;

        // Payment status based on method
        const paymentStatus = paymentMethod === "contrarembolso" ? "pending" : "pending";

        // Create order
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
            paymentStatus,
            subtotal,
            discount: discount || 0,
            shippingCost: shippingCost || 0,
            total,
            couponCode: couponCode || null,
            createdAt: now,
            updatedAt: now,
        });

        // Create order items
        for (const item of cartItems) {
            await db.insert(orderItems).values({
                id: randomUUID(),
                orderId,
                productId: item.id || null,
                productName: item.name,
                productSku: item.sku || item.id || "",
                quantity: item.quantity,
                unitPrice: item.price,
                totalPrice: item.price * item.quantity,
                createdAt: now,
            });
        }

        // Initial status history
        await db.insert(orderStatusHistory).values({
            id: randomUUID(),
            orderId,
            status: "new",
            changedBy: "system",
            notes: "Pedido creado desde la tienda web",
            createdAt: now,
        });

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

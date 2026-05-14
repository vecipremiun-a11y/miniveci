import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatMessages, customers, orders } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { asc, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/chat/conversations/[id]
 * Detalle de una conversación: mensajes + info del cliente + sus pedidos recientes.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth();
        const { id } = await context.params;

        const conversation = await db.query.chatConversations.findFirst({
            where: eq(chatConversations.id, id),
        });
        if (!conversation) {
            return NextResponse.json({ error: "No encontrada" }, { status: 404 });
        }

        const messages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.conversationId, id))
            .orderBy(asc(chatMessages.createdAt))
            .limit(500);

        let customerInfo: any = null;
        let recentOrders: any[] = [];
        let totalOrders = 0;
        let totalSpent = 0;

        if (conversation.customerId) {
            const customer = await db.query.customers.findFirst({
                where: eq(customers.id, conversation.customerId),
            });
            if (customer) {
                customerInfo = {
                    id: customer.id,
                    name: `${customer.firstName} ${customer.lastName}`.trim(),
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address,
                    comuna: customer.comuna,
                    city: customer.city,
                };

                const ordersList = await db
                    .select()
                    .from(orders)
                    .where(eq(orders.customerId, customer.id))
                    .orderBy(desc(orders.createdAt))
                    .limit(5);

                recentOrders = ordersList.map(o => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    total: o.total,
                    createdAt: o.createdAt,
                }));

                const stats = await db
                    .select({
                        count: sql<number>`count(*)`,
                        total: sql<number>`coalesce(sum(${orders.total}), 0)`,
                    })
                    .from(orders)
                    .where(eq(orders.customerId, customer.id));
                totalOrders = stats[0]?.count ?? 0;
                totalSpent = stats[0]?.total ?? 0;
            }
        }

        // Marcar mensajes como leídos por agente
        if (conversation.unreadAgent && conversation.unreadAgent > 0) {
            await db
                .update(chatConversations)
                .set({ unreadAgent: 0 })
                .where(eq(chatConversations.id, id));
        }

        return NextResponse.json({
            conversation: {
                id: conversation.id,
                status: conversation.status,
                createdAt: conversation.createdAt,
                lastMessageAt: conversation.lastMessageAt,
                guest: customerInfo ? null : {
                    id: conversation.guestId,
                    name: conversation.guestName,
                    email: conversation.guestEmail,
                },
            },
            customer: customerInfo,
            stats: customerInfo ? { totalOrders, totalSpent } : null,
            recentOrders,
            messages: messages.map(m => ({
                id: m.id,
                senderType: m.senderType,
                senderId: m.senderId,
                senderName: m.senderName,
                body: m.body,
                createdAt: m.createdAt,
            })),
        });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_CHAT_DETAIL]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/chat/conversations/[id]
 * Cambiar estado (cerrar/reabrir) o asignar operador.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireAuth();
        const { id } = await context.params;
        const body = await req.json().catch(() => ({}));

        const update: any = { updatedAt: new Date().toISOString() };
        if (body.status === "open" || body.status === "closed") update.status = body.status;
        if (body.assignToMe) update.assignedOperatorId = session.user.id;

        if (Object.keys(update).length === 1) {
            return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
        }

        await db.update(chatConversations).set(update).where(eq(chatConversations.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_CHAT_PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

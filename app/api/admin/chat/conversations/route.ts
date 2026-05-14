import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, customers } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/chat/conversations?status=open|closed|all
 * Lista las conversaciones con info básica del cliente.
 */
export async function GET(req: NextRequest) {
    try {
        await requireAuth();
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get("status") || "open";

        const rows = await db
            .select({
                conv: chatConversations,
                customer: customers,
            })
            .from(chatConversations)
            .leftJoin(customers, eq(chatConversations.customerId, customers.id))
            .where(statusFilter === "all" ? sql`1=1` : eq(chatConversations.status, statusFilter))
            .orderBy(desc(chatConversations.lastMessageAt), desc(chatConversations.createdAt))
            .limit(200);

        const data = rows.map(({ conv, customer }) => ({
            id: conv.id,
            status: conv.status,
            lastMessageAt: conv.lastMessageAt,
            lastMessagePreview: conv.lastMessagePreview,
            unreadAgent: conv.unreadAgent ?? 0,
            assignedOperatorId: conv.assignedOperatorId,
            createdAt: conv.createdAt,
            customer: customer
                ? {
                    id: customer.id,
                    name: `${customer.firstName} ${customer.lastName}`.trim(),
                    email: customer.email,
                    phone: customer.phone,
                }
                : null,
            guest: customer
                ? null
                : {
                    id: conv.guestId,
                    name: conv.guestName,
                    email: conv.guestEmail,
                },
        }));

        return NextResponse.json({ conversations: data });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_CHAT_LIST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bakeryOrders, bakeryOrderItems } from "@/lib/db/schema";
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, not } from "drizzle-orm";
import { serializeOrder } from "@/lib/bakery";
import { BAKERY_STATUSES, type BakeryStatus } from "@/lib/validations/bakery";
import { requirePosCredentials, withPosCors } from "@/lib/pos-auth";

export const dynamic = "force-dynamic";

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

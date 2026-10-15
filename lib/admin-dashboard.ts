import { and, desc, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
    bakeryOrderItems,
    bakeryOrders,
    chatConversations,
    customers,
    orderItems,
    orders,
    products,
} from "@/lib/db/schema";
import { STORE_ACTIVE_STATES } from "@/lib/store-status";
import { chileLocalToUtcISO } from "@/lib/timezone";

/**
 * Datos del dashboard del admin, leídos de la base real.
 *
 * "Ventas" = pedidos de tienda en estado activo (confirmado en adelante, ver
 * STORE_ACTIVE_STATES) + encargos de amasandería no cancelados. Un pedido de
 * tienda en "new" todavía no es venta: puede ser un checkout de Mercado Pago
 * abandonado.
 *
 * Los días y horas se agrupan en hora de Chile; created_at se guarda en UTC.
 */

const CHILE_TZ = "America/Santiago";
const CHART_DAYS = 30;
const LOW_STOCK_MAX = 5;
const BAKERY_OPEN_STATES = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"];
const STORE_OPEN_STATES = ["new", "confirmed", "paid", "preparing", "ready", "shipped"];
const MP_METHODS = ["mercadopago", "mercado_pago"];

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: CHILE_TZ });
const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: CHILE_TZ, hour: "numeric", hourCycle: "h23" });
const dayLabelFmt = new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", day: "numeric", month: "short" });
const weekdayLabelFmt = new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "short", day: "numeric" });

/** "YYYY-MM-DD" del día en Chile para un instante. */
function chileDayKey(instant: Date): string {
    return dayKeyFmt.format(instant);
}

/** Suma días a una clave "YYYY-MM-DD" (aritmética de calendario, sin DST). */
function addDays(dayKey: string, days: number): string {
    const [y, m, d] = dayKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dayKeyAsUtcDate(dayKey: string): Date {
    return new Date(`${dayKey}T00:00:00Z`);
}

export type SalesPoint = { label: string; tienda: number; encargos: number };

export type DashboardData = {
    stats: {
        salesToday: number;
        salesYesterday: number;
        ordersToday: number;
        storeOpen: number;
        storeNew: number;
        bakeryOpen: number;
        bakeryForToday: number;
        bakeryOverdue: number;
        customersWeek: number;
        customersToday: number;
        customersTotal: number;
    };
    sales: { hoy: SalesPoint[]; semana: SalesPoint[]; mes: SalesPoint[] };
    alerts: {
        outOfStock: number;
        lowStock: number;
        bakeryPending: number;
        awaitingOnlinePayment: number;
        supportOpen: number;
        supportUnread: number;
    };
    recentOrders: {
        id: string;
        orderNumber: string;
        customerName: string;
        total: number;
        status: string;
        createdAt: string;
    }[];
    topProducts: { name: string; source: "tienda" | "amasanderia"; quantity: number; revenue: number }[];
};

export async function getDashboardData(now = new Date()): Promise<DashboardData> {
    const todayKey = chileDayKey(now);
    const yesterdayKey = addDays(todayKey, -1);
    const firstChartDay = addDays(todayKey, -(CHART_DAYS - 1));
    const windowStart = chileLocalToUtcISO(`${firstChartDay}T00:00`)!;
    const weekStart = chileLocalToUtcISO(`${addDays(todayKey, -6)}T00:00`)!;
    const todayStart = chileLocalToUtcISO(`${todayKey}T00:00`)!;

    const [
        storeRows,
        bakeryRows,
        storeOpenRows,
        bakeryOpenRows,
        customerRows,
        stockRows,
        supportRows,
        recentOrders,
        storeTop,
        bakeryTop,
    ] = await Promise.all([
        db.select({ total: orders.total, status: orders.status, createdAt: orders.createdAt })
            .from(orders)
            .where(and(gte(orders.createdAt, windowStart), inArray(orders.status, STORE_ACTIVE_STATES))),
        db.select({ total: bakeryOrders.total, createdAt: bakeryOrders.createdAt })
            .from(bakeryOrders)
            .where(and(gte(bakeryOrders.createdAt, windowStart), ne(bakeryOrders.status, "cancelled"))),
        db.select({
            status: orders.status,
            paymentMethod: orders.paymentMethod,
            paymentStatus: orders.paymentStatus,
        })
            .from(orders)
            .where(inArray(orders.status, STORE_OPEN_STATES)),
        db.select({ status: bakeryOrders.status, scheduledFor: bakeryOrders.scheduledFor })
            .from(bakeryOrders)
            .where(inArray(bakeryOrders.status, BAKERY_OPEN_STATES)),
        // datetime() normaliza: hay clientes con CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS") y otros con ISO.
        db.select({
            total: sql<number>`count(*)`,
            week: sql<number>`sum(case when datetime(${customers.createdAt}) >= datetime(${weekStart}) then 1 else 0 end)`,
            today: sql<number>`sum(case when datetime(${customers.createdAt}) >= datetime(${todayStart}) then 1 else 0 end)`,
        }).from(customers),
        // Stock web = webStock (la fuente "reserved" no se usa hoy; ver product-resolver).
        db.select({
            outOfStock: sql<number>`sum(case when coalesce(${products.webStock}, 0) <= 0 then 1 else 0 end)`,
            lowStock: sql<number>`sum(case when ${products.webStock} > 0 and ${products.webStock} <= ${LOW_STOCK_MAX} then 1 else 0 end)`,
        }).from(products).where(sql`${products.isPublished} = 1`),
        db.select({
            open: sql<number>`count(*)`,
            unread: sql<number>`sum(case when coalesce(${chatConversations.unreadAgent}, 0) > 0 then 1 else 0 end)`,
        }).from(chatConversations).where(sql`${chatConversations.status} = 'open'`),
        db.select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            customerName: orders.customerName,
            total: orders.total,
            status: orders.status,
            createdAt: orders.createdAt,
        }).from(orders).orderBy(desc(orders.createdAt)).limit(6),
        db.select({
            name: orderItems.productName,
            quantity: sql<number>`sum(${orderItems.quantity})`,
            revenue: sql<number>`sum(${orderItems.totalPrice})`,
        })
            .from(orderItems)
            .innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
            .where(and(gte(orders.createdAt, windowStart), inArray(orders.status, STORE_ACTIVE_STATES)))
            .groupBy(orderItems.productName),
        db.select({
            name: bakeryOrderItems.productName,
            quantity: sql<number>`sum(${bakeryOrderItems.quantity})`,
            revenue: sql<number>`sum(${bakeryOrderItems.subtotal})`,
        })
            .from(bakeryOrderItems)
            .innerJoin(bakeryOrders, sql`${bakeryOrders.id} = ${bakeryOrderItems.orderId}`)
            .where(and(gte(bakeryOrders.createdAt, windowStart), ne(bakeryOrders.status, "cancelled")))
            .groupBy(bakeryOrderItems.productName),
    ]);

    // ── Ventas por día / hora (Chile) ─────────────────────────────────
    const byDay = new Map<string, { tienda: number; encargos: number }>();
    const todayByHour = Array.from({ length: 24 }, () => ({ tienda: 0, encargos: 0 }));
    let ordersToday = 0;

    const addSale = (createdAt: string | null, total: number, kind: "tienda" | "encargos") => {
        if (!createdAt) return;
        const instant = new Date(createdAt);
        if (Number.isNaN(instant.getTime())) return;
        const key = chileDayKey(instant);
        const bucket = byDay.get(key) ?? { tienda: 0, encargos: 0 };
        bucket[kind] += total;
        byDay.set(key, bucket);
        if (key === todayKey) {
            todayByHour[Number(hourFmt.format(instant)) % 24][kind] += total;
            ordersToday += 1;
        }
    };
    for (const o of storeRows) addSale(o.createdAt, o.total, "tienda");
    for (const o of bakeryRows) addSale(o.createdAt, o.total, "encargos");

    const dayPoints = (days: number, fmt: Intl.DateTimeFormat): SalesPoint[] =>
        Array.from({ length: days }, (_, i) => {
            const key = addDays(todayKey, i - (days - 1));
            const b = byDay.get(key) ?? { tienda: 0, encargos: 0 };
            return { label: fmt.format(dayKeyAsUtcDate(key)), ...b };
        });

    // Solo hasta la hora actual: las horas futuras en 0 parecerían una caída.
    const currentHour = Number(hourFmt.format(now)) % 24;
    const hourPoints: SalesPoint[] = todayByHour
        .slice(0, currentHour + 1)
        .map((b, h) => ({ label: `${String(h).padStart(2, "0")}:00`, ...b }));

    const dayTotal = (key: string) => {
        const b = byDay.get(key);
        return b ? b.tienda + b.encargos : 0;
    };

    // ── Pedidos y encargos abiertos ───────────────────────────────────
    const isAwaitingOnlinePayment = (o: (typeof storeOpenRows)[number]) =>
        o.status === "new" && o.paymentStatus === "pending" && MP_METHODS.includes(o.paymentMethod ?? "");
    const awaitingOnlinePayment = storeOpenRows.filter(isAwaitingOnlinePayment).length;
    const storeActionable = storeOpenRows.filter((o) => !isAwaitingOnlinePayment(o));

    // scheduledFor viene en hora local de Chile sin offset ("2026-10-03T13:00:00").
    const bakeryForToday = bakeryOpenRows.filter((o) => o.scheduledFor.slice(0, 10) === todayKey).length;
    const bakeryOverdue = bakeryOpenRows.filter((o) => o.scheduledFor.slice(0, 10) < todayKey).length;

    // ── Más vendidos (tienda + amasandería) ───────────────────────────
    const topProducts = [
        ...storeTop.map((p) => ({ ...p, source: "tienda" as const })),
        ...bakeryTop.map((p) => ({ ...p, source: "amasanderia" as const })),
    ]
        .map((p) => ({ ...p, quantity: Number(p.quantity) || 0, revenue: Number(p.revenue) || 0 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    const customerStats = customerRows[0];
    const stock = stockRows[0];
    const support = supportRows[0];

    return {
        stats: {
            salesToday: dayTotal(todayKey),
            salesYesterday: dayTotal(yesterdayKey),
            ordersToday,
            storeOpen: storeActionable.length,
            storeNew: storeActionable.filter((o) => o.status === "new").length,
            bakeryOpen: bakeryOpenRows.length,
            bakeryForToday,
            bakeryOverdue,
            customersWeek: Number(customerStats?.week) || 0,
            customersToday: Number(customerStats?.today) || 0,
            customersTotal: Number(customerStats?.total) || 0,
        },
        sales: {
            hoy: hourPoints,
            semana: dayPoints(7, weekdayLabelFmt),
            mes: dayPoints(CHART_DAYS, dayLabelFmt),
        },
        alerts: {
            outOfStock: Number(stock?.outOfStock) || 0,
            lowStock: Number(stock?.lowStock) || 0,
            bakeryPending: bakeryOpenRows.filter((o) => o.status === "pending").length,
            awaitingOnlinePayment,
            supportOpen: Number(support?.open) || 0,
            supportUnread: Number(support?.unread) || 0,
        },
        recentOrders: recentOrders.map((o) => ({
            ...o,
            status: o.status ?? "new",
            createdAt: o.createdAt ?? "",
        })),
        topProducts,
    };
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { desc, asc, eq, like, and, or, sql, gte, lte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("payment_status");
    const deliveryType = searchParams.get("delivery_type");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const comuna = searchParams.get("comuna");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";

    const conditions: any[] = [];

    if (search) {
      conditions.push(
        or(
          like(orders.orderNumber, `%${search}%`),
          like(orders.customerName, `%${search}%`),
          like(orders.customerEmail, `%${search}%`)
        )
      );
    }
    if (status && status !== "all") conditions.push(eq(orders.status, status));
    if (paymentStatus && paymentStatus !== "all") conditions.push(eq(orders.paymentStatus, paymentStatus));
    if (deliveryType && deliveryType !== "all") conditions.push(eq(orders.deliveryType, deliveryType));
    if (comuna) conditions.push(like(orders.shippingComuna, `%${comuna}%`));

    if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom).toISOString()));
    // Set dateTo to end of day
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(orders.createdAt, to.toISOString()));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    let orderBy = desc(orders.createdAt);
    if (sort === "orderNumber") orderBy = order === "asc" ? asc(orders.orderNumber) : desc(orders.orderNumber);
    if (sort === "total") orderBy = order === "asc" ? asc(orders.total) : desc(orders.total);
    if (sort === "customerName") orderBy = order === "asc" ? asc(orders.customerName) : desc(orders.customerName);

    const data = await db.select()
      .from(orders)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy);

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereCondition);

    const total = countResult[0].count;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      orders: data,
      total,
      page,
      totalPages
    });

  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[ORDERS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Optional: Manual order creation from admin panel
  return NextResponse.json({ error: "Not Implemented" }, { status: 501 });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderItems, orderStatusHistory, orders, products } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { syncPaidOrderToPos } from "@/services/pos-sync";
import { desc, asc, eq, like, and, or, sql, gte, lte } from "drizzle-orm";
import * as z from "zod";

const orderCreateSchema = z.object({
  external_order_id: z.string().optional(),
  status: z.string().optional(),
  client_name: z.string().optional(),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().optional(),
  payment_method: z.string().optional(),
  observation: z.string().optional(),
  total: z.number().optional(),
  items: z.array(z.object({
    pos_id: z.string().optional(),
    sku: z.string().optional(),
    name: z.string().optional(),
    quantity: z.number().positive(),
    price: z.number().nonnegative(),
  })).min(1),
});

function mapIncomingStatus(status?: string) {
  switch (status) {
    case "pending":
    case undefined:
      return "new";
    case "paid":
    case "preparing":
    case "ready":
    case "shipped":
    case "delivered":
    case "cancelled":
    case "refunded":
      return status;
    default:
      return "new";
  }
}

function mapPaymentStatus(status?: string) {
  switch (status) {
    case "paid":
    case "preparing":
    case "ready":
    case "shipped":
    case "delivered":
      return "paid";
    case "refunded":
      return "refunded";
    case "cancelled":
      return "failed";
    default:
      return "pending";
  }
}

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
  try {
    const session = await requireAuth();
    const body = await req.json();
    const data = orderCreateSchema.parse(body);
    const now = new Date().toISOString();
    const orderId = crypto.randomUUID();
    const orderNumber = data.external_order_id || `WEB-${Date.now()}`;
    const normalizedStatus = mapIncomingStatus(data.status);
    const subtotal = data.items.reduce((sum, item) => sum + Math.round(item.quantity * item.price), 0);
    const total = data.total != null ? Math.round(data.total) : subtotal;

    const productMatches = await Promise.all(data.items.map(async (item) => {
      if (item.sku) {
        const bySku = await db.select({ id: products.id }).from(products).where(eq(products.sku, item.sku)).limit(1);
        return bySku[0]?.id ?? null;
      }

      return null;
    }));

    await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        id: orderId,
        orderNumber,
        customerName: data.client_name || "Cliente web",
        customerEmail: data.customer_email || `${orderNumber.toLowerCase()}@local.invalid`,
        customerPhone: data.customer_phone || null,
        customerRut: null,
        shippingAddress: null,
        shippingComuna: null,
        shippingCity: null,
        shippingNotes: data.observation || null,
        deliveryType: "pickup",
        deliveryDate: null,
        deliveryTimeSlot: null,
        status: normalizedStatus,
        paymentMethod: data.payment_method || null,
        paymentStatus: mapPaymentStatus(data.status),
        paymentId: null,
        subtotal,
        discount: 0,
        shippingCost: 0,
        total,
        internalNotes: data.observation || null,
        couponCode: null,
        createdAt: now,
        updatedAt: now,
      });

      for (let index = 0; index < data.items.length; index += 1) {
        const item = data.items[index];
        const unitPrice = Math.round(item.price);
        await tx.insert(orderItems).values({
          id: crypto.randomUUID(),
          orderId,
          productId: productMatches[index],
          productName: item.name || `Producto ${index + 1}`,
          productSku: item.sku || `POS-${item.pos_id || index + 1}`,
          quantity: Math.round(item.quantity),
          unitPrice,
          totalPrice: Math.round(item.quantity * unitPrice),
          stockSource: "manual",
          createdAt: now,
        });
      }

      await tx.insert(orderStatusHistory).values({
        id: crypto.randomUUID(),
        orderId,
        status: normalizedStatus,
        changedBy: session.user?.id || session.user?.email || "admin",
        notes: data.observation || "Pedido creado manualmente",
        createdAt: now,
      });
    });

    if (normalizedStatus === "paid") {
      try {
        await syncPaidOrderToPos(orderId);
      } catch (syncError) {
        console.error("[ORDERS_POST][POS_SYNC]", syncError);
      }
    }

    return NextResponse.json({ success: true, orderId, orderNumber }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.name === "ZodError" || error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
    }
    console.error("[ORDERS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

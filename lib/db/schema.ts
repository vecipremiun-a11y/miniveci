import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

// --- AUTHENTICATION ---

export const users = sqliteTable("users", {
    id: text("id").primaryKey(), // crypto.randomUUID or nanoid
    email: text("email").unique().notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("admin"), // "owner", "admin", "preparacion", "reparto", "contenido"
    avatarUrl: text("avatar_url"),
    active: integer("active", { mode: "boolean" }).default(true),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at"),
});

// --- CATALOG ---

export const categories = sqliteTable("categories", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    parentId: text("parent_id"), // self-reference logic handled in app
    sortOrder: integer("sort_order").default(0),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    syncPriceSource: text("sync_price_source").default("global"), // "global", "pos", "manual"
    syncStockSource: text("sync_stock_source").default("global"), // "global", "pos", "manual"
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const products = sqliteTable("products", {
    id: text("id").primaryKey(),
    sku: text("sku").unique().notNull(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    description: text("description"),
    categoryId: text("category_id").references(() => categories.id),

    // Costos / Margen
    costPrice: integer("cost_price"), // cents — precio de costo del POS
    profitMargin: real("profit_margin"), // porcentaje de margen de ganancia

    // Datos Web (Editable)
    webPrice: integer("web_price"), // cents
    webStock: integer("web_stock"),
    webTitle: text("web_title"),
    webDescription: text("web_description"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    // Source Control
    priceSource: text("price_source").default("global"), // "global", "pos", "manual"
    stockSource: text("stock_source").default("global"), // "global", "pos", "manual", "reserved"
    reservedQty: integer("reserved_qty").default(0),

    // Status
    isPublished: integer("is_published", { mode: "boolean" }).default(false),
    isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
    sortOrder: integer("sort_order").default(0),
    tags: text("tags", { mode: "json" }), // array of strings
    badges: text("badges", { mode: "json" }), // array of strings

    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    slugIdx: index("slug_idx").on(table.slug),
    skuIdx: index("sku_idx").on(table.sku),
    categoryIdIdx: index("category_id_idx").on(table.categoryId),
}));

export const productImages = sqliteTable("product_images", {
    id: text("id").primaryKey(),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").default(0),
    isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
});

// --- ORDERS ---

export const orders = sqliteTable("orders", {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").unique().notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    customerRut: text("customer_rut"),

    // Address
    shippingAddress: text("shipping_address"),
    shippingComuna: text("shipping_comuna"),
    shippingCity: text("shipping_city"),
    shippingNotes: text("shipping_notes"),

    // Delivery
    deliveryType: text("delivery_type").notNull(), // "delivery", "pickup"
    deliveryDate: text("delivery_date"),
    deliveryTimeSlot: text("delivery_time_slot"),

    // Status
    status: text("status").default("new"), // "new", "paid", "preparing", "ready", "shipped", "delivered", "cancelled", "refunded"

    // Payment
    paymentMethod: text("payment_method"),
    paymentStatus: text("payment_status").default("pending"),
    paymentId: text("payment_id"),

    // Totals
    subtotal: integer("subtotal").notNull(), // cents
    discount: integer("discount").default(0),
    shippingCost: integer("shipping_cost").default(0),
    total: integer("total").notNull(),

    // Notes
    internalNotes: text("internal_notes"),
    couponCode: text("coupon_code"),

    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    orderNumberIdx: index("order_number_idx").on(table.orderNumber),
    statusIdx: index("status_idx").on(table.status),
    customerEmailIdx: index("customer_email_idx").on(table.customerEmail),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export const orderItems = sqliteTable("order_items", {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id),
    productName: text("product_name").notNull(),
    productSku: text("product_sku").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(), // cents
    totalPrice: integer("total_price").notNull(),
    stockSource: text("stock_source"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const orderStatusHistory = sqliteTable("order_status_history", {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    changedBy: text("changed_by"), // user_id or "system"
    notes: text("notes"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const apiCredentials = sqliteTable("api_credentials", {
    id: text("id").primaryKey().default("main"),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret").notNull(),
    posWebhookUrl: text("pos_webhook_url").notNull(),
    webhookSecret: text("webhook_secret").notNull().default(""),
});

// --- RELATIONS ---

export const usersRelations = relations(users, ({ many }) => ({
    sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
    products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
    category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
    images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
    product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
    items: many(orderItems),
    statusHistory: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
    product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
    order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
}));

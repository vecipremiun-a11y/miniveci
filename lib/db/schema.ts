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

// --- CUSTOMERS (Store) ---

export const customers = sqliteTable("customers", {
    id: text("id").primaryKey(),
    email: text("email").unique().notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone").notNull(),
    rut: text("rut"),

    // Dirección principal (legacy, se mantiene por compatibilidad)
    address: text("address"),
    comuna: text("comuna"),
    city: text("city").default("Santiago"),
    addressNotes: text("address_notes"),

    active: integer("active", { mode: "boolean" }).default(true),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    customerEmailIdx: index("customer_email_idx_unique").on(table.email),
}));

export const customerAddresses = sqliteTable("customer_addresses", {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
    label: text("label").notNull().default("Casa"),
    address: text("address").notNull(),
    comuna: text("comuna").notNull(),
    city: text("city").notNull().default("Santiago"),
    addressNotes: text("address_notes"),
    isDefault: integer("is_default", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    customerIdIdx: index("customer_address_customer_id_idx").on(table.customerId),
}));

// --- CATALOG ---

// --- BANNERS (Homepage Carousel) ---

export const banners = sqliteTable("banners", {
    id: text("id").primaryKey(),
    title: text("title"),
    imageUrl: text("image_url").notNull(),
    linkUrl: text("link_url"),
    sortOrder: integer("sort_order").default(0),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

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
    costPrice: integer("cost_price"), // CLP (pesos) — precio de costo del POS
    profitMargin: real("profit_margin"), // porcentaje de margen de ganancia
    subscriptionPrice: integer("subscription_price"), // CLP — precio para suscriptores

    // Datos Web (Editable)
    webPrice: integer("web_price"), // CLP (pesos)
    webStock: real("web_stock"),
    webTitle: text("web_title"),
    webDescription: text("web_description"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    // Source Control
    priceSource: text("price_source").default("global"), // "global", "pos", "manual"
    stockSource: text("stock_source").default("global"), // "global", "pos", "manual", "reserved"
    reservedQty: integer("reserved_qty").default(0),

    // POS Sync Fields
    offerPrice: integer("offer_price"),           // CLP (pesos) — precio de oferta
    isOffer: integer("is_offer", { mode: "boolean" }).default(false),
    unit: text("unit").default("Und"),              // Und, Kg, Lt, etc.
    equivLabel: text("equiv_label"),                  // Etiqueta de venta por unidad (ej: "Palta", "Pechuga")
    equivWeight: real("equiv_weight"),                // Peso equivalente en kg (ej: 0.365)
    taxRate: real("tax_rate"),                       // ej: 19 para 19%

    // Status
    isPublished: integer("is_published", { mode: "boolean" }).default(false),
    isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
    sortOrder: integer("sort_order").default(0),
    tags: text("tags", { mode: "json" }), // array of strings
    badges: text("badges", { mode: "json" }), // array of strings
    priceTiers: text("price_tiers", { mode: "json" }), // [{minQty, maxQty, price}]

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
    customerId: text("customer_id").references(() => customers.id),
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
    subtotal: integer("subtotal").notNull(), // CLP (pesos)
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
    unitPrice: integer("unit_price").notNull(), // CLP (pesos)
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

export const customersRelations = relations(customers, ({ many }) => ({
    orders: many(orders),
    addresses: many(customerAddresses),
    subscriptions: many(subscriptions),
    paymentMethods: many(customerPaymentMethods),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
    customer: one(customers, { fields: [customerAddresses.customerId], references: [customers.id] }),
}));

// --- SUBSCRIPTIONS ---

export const subscriptions = sqliteTable("subscriptions", {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
    plan: text("plan").notNull().default("premium"), // "premium"
    status: text("status").notNull().default("active"), // "active", "expired", "cancelled"
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    price: integer("price").notNull(), // CLP pagado
    paymentMethod: text("payment_method"),
    paymentId: text("payment_id"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    customerIdIdx: index("subscription_customer_id_idx").on(table.customerId),
    statusIdx: index("subscription_status_idx").on(table.status),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
    customer: one(customers, { fields: [subscriptions.customerId], references: [customers.id] }),
}));

// --- CUSTOMER PAYMENT METHODS (Mercado Pago tokens) ---

export const customerPaymentMethods = sqliteTable("customer_payment_methods", {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
    mpCustomerId: text("mp_customer_id"), // Mercado Pago customer ID
    mpCardId: text("mp_card_id"), // Mercado Pago card token ID
    brand: text("brand"), // "visa", "mastercard", "amex"
    lastFourDigits: text("last_four_digits"),
    expirationMonth: integer("expiration_month"),
    expirationYear: integer("expiration_year"),
    cardholderName: text("cardholder_name"),
    isDefault: integer("is_default", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    customerIdIdx: index("cpm_customer_id_idx").on(table.customerId),
}));

export const customerPaymentMethodsRelations = relations(customerPaymentMethods, ({ one }) => ({
    customer: one(customers, { fields: [customerPaymentMethods.customerId], references: [customers.id] }),
}));

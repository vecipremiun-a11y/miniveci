import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
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
    avatarUrl: text("avatar_url"),

    // Dirección principal (legacy, se mantiene por compatibilidad)
    address: text("address"),
    comuna: text("comuna"),
    city: text("city").default("Santiago"),
    addressNotes: text("address_notes"),

    // Google Sign-In: ID de Google (sub claim) + flag de email verificado por Google.
    googleId: text("google_id").unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false),

    active: integer("active", { mode: "boolean" }).default(true),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    customerEmailIdx: index("customer_email_idx_unique").on(table.email),
    customerGoogleIdIdx: index("customer_google_id_idx").on(table.googleId),
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
    // ID interno permanente del producto en POSVECI. Llave maestra del sync:
    // el SKU/código de barras puede cambiar, este no. Match por aquí evita duplicados.
    posProductId: text("pos_product_id"),
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
    posProductIdIdx: index("products_pos_product_id_idx").on(table.posProductId),
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
    mpPreApprovalId: text("mp_pre_approval_id"),
    paymentHistory: text("payment_history", { mode: "json" }), // [{date, amount, paymentId, status}]
    cancelledAt: text("cancelled_at"),
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

// --- CHAT / SOPORTE ---

export const chatConversations = sqliteTable("chat_conversations", {
    id: text("id").primaryKey(),
    // Cliente registrado (opcional)
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    // Visitante anónimo (UUID generado en cliente y guardado en localStorage)
    guestId: text("guest_id"),
    guestName: text("guest_name"),
    guestEmail: text("guest_email"),
    // Operador asignado (opcional, primer operador que responda queda asignado)
    assignedOperatorId: text("assigned_operator_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("open"), // "open" | "closed"
    lastMessageAt: text("last_message_at"),
    lastMessagePreview: text("last_message_preview"),
    unreadCustomer: integer("unread_customer").default(0),
    unreadAgent: integer("unread_agent").default(0),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    customerIdIdx: index("chat_customer_id_idx").on(table.customerId),
    guestIdIdx: index("chat_guest_id_idx").on(table.guestId),
    statusIdx: index("chat_status_idx").on(table.status),
    lastMessageAtIdx: index("chat_last_message_at_idx").on(table.lastMessageAt),
}));

export const chatMessages = sqliteTable("chat_messages", {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").references(() => chatConversations.id, { onDelete: "cascade" }).notNull(),
    senderType: text("sender_type").notNull(), // "customer" | "agent" | "system"
    senderId: text("sender_id"), // users.id o customers.id; null para sistema o invitado
    senderName: text("sender_name"), // cacheado para mostrar
    body: text("body").notNull(),
    // Adjunto opcional: imagen / PDF / audio / archivo genérico.
    // `body` puede quedar vacío si el mensaje es solo un adjunto.
    messageType: text("message_type").notNull().default("text"), // "text" | "image" | "audio" | "file"
    attachmentUrl: text("attachment_url"),
    attachmentName: text("attachment_name"),
    attachmentSize: integer("attachment_size"),
    mimeType: text("mime_type"),
    readByCustomer: integer("read_by_customer", { mode: "boolean" }).default(false),
    readByAgent: integer("read_by_agent", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    conversationIdIdx: index("chat_msg_conversation_id_idx").on(table.conversationId),
    createdAtIdx: index("chat_msg_created_at_idx").on(table.createdAt),
    messageTypeIdx: index("chat_msg_message_type_idx").on(table.messageType),
}));

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
    customer: one(customers, { fields: [chatConversations.customerId], references: [customers.id] }),
    assignedOperator: one(users, { fields: [chatConversations.assignedOperatorId], references: [users.id] }),
    messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
    conversation: one(chatConversations, { fields: [chatMessages.conversationId], references: [chatConversations.id] }),
}));

// --- RAFFLES / SORTEOS ---

export const raffles = sqliteTable("raffles", {
    id: text("id").primaryKey(),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(), // "free" | "paid"
    price: integer("price"), // CLP, null si type === "free"
    audience: text("audience").notNull().default("all"), // "all" | "customers" | "subscribers"
    totalNumbers: integer("total_numbers").notNull(), // ej 50 → números 1..50
    status: text("status").notNull().default("draft"), // "draft" | "active" | "closed" | "drawn"
    startsAt: text("starts_at"),
    endsAt: text("ends_at"), // cierre de ventas
    drawAt: text("draw_at"), // fecha programada para el sorteo
    coverImage: text("cover_image"),
    terms: text("terms"), // términos y condiciones
    featured: integer("featured", { mode: "boolean" }).default(false), // destacado en home
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    slugIdx: index("raffles_slug_idx").on(table.slug),
    statusIdx: index("raffles_status_idx").on(table.status),
}));

export const raffleImages = sqliteTable("raffle_images", {
    id: text("id").primaryKey(),
    raffleId: text("raffle_id").notNull().references(() => raffles.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").default(0),
    isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    raffleIdIdx: index("raffle_images_raffle_id_idx").on(table.raffleId),
}));

export const rafflePrizes = sqliteTable("raffle_prizes", {
    id: text("id").primaryKey(),
    raffleId: text("raffle_id").notNull().references(() => raffles.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // 1 = primer premio, 2 = segundo, etc
    name: text("name").notNull(),
    description: text("description"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    raffleIdIdx: index("raffle_prizes_raffle_id_idx").on(table.raffleId),
}));

export const raffleEntries = sqliteTable("raffle_entries", {
    id: text("id").primaryKey(),
    raffleId: text("raffle_id").notNull().references(() => raffles.id, { onDelete: "cascade" }),
    number: integer("number").notNull(), // 1..totalNumbers
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    guestName: text("guest_name"),
    guestEmail: text("guest_email"),
    guestPhone: text("guest_phone"),
    guestAddress: text("guest_address"),
    receiptNumber: text("receipt_number"), // Número de boleta del local físico (sorteos in-store / temporada)
    status: text("status").notNull(), // "reserved" | "paid" | "free" | "cancelled"
    reservedAt: text("reserved_at").default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at"), // para status "reserved"
    paidAt: text("paid_at"),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    raffleNumberUnq: index("raffle_entries_raffle_number_unq_idx").on(table.raffleId, table.number),
    customerIdx: index("raffle_entries_customer_idx").on(table.customerId),
    statusIdx: index("raffle_entries_status_idx").on(table.status),
    orderIdx: index("raffle_entries_order_idx").on(table.orderId),
}));

export const raffleWinners = sqliteTable("raffle_winners", {
    id: text("id").primaryKey(),
    raffleId: text("raffle_id").notNull().references(() => raffles.id, { onDelete: "cascade" }),
    prizeId: text("prize_id").notNull().references(() => rafflePrizes.id, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull().references(() => raffleEntries.id, { onDelete: "cascade" }),
    drawnAt: text("drawn_at").default(sql`CURRENT_TIMESTAMP`),
    notified: integer("notified", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    raffleIdx: index("raffle_winners_raffle_idx").on(table.raffleId),
}));

export const rafflesRelations = relations(raffles, ({ many }) => ({
    images: many(raffleImages),
    prizes: many(rafflePrizes),
    entries: many(raffleEntries),
    winners: many(raffleWinners),
}));

export const raffleImagesRelations = relations(raffleImages, ({ one }) => ({
    raffle: one(raffles, { fields: [raffleImages.raffleId], references: [raffles.id] }),
}));

export const rafflePrizesRelations = relations(rafflePrizes, ({ one }) => ({
    raffle: one(raffles, { fields: [rafflePrizes.raffleId], references: [raffles.id] }),
}));

export const raffleEntriesRelations = relations(raffleEntries, ({ one }) => ({
    raffle: one(raffles, { fields: [raffleEntries.raffleId], references: [raffles.id] }),
    customer: one(customers, { fields: [raffleEntries.customerId], references: [customers.id] }),
    order: one(orders, { fields: [raffleEntries.orderId], references: [orders.id] }),
}));

export const raffleWinnersRelations = relations(raffleWinners, ({ one }) => ({
    raffle: one(raffles, { fields: [raffleWinners.raffleId], references: [raffles.id] }),
    prize: one(rafflePrizes, { fields: [raffleWinners.prizeId], references: [rafflePrizes.id] }),
    entry: one(raffleEntries, { fields: [raffleWinners.entryId], references: [raffleEntries.id] }),
}));

// --- AMASANDERÍA / BAKERY (encargos a futuro) ---
// Módulo independiente del módulo Tienda (compra inmediata). Tablas, endpoints
// y estado totalmente separados. Precios en CLP enteros (INTEGER), nunca floats.

export const bakeryProducts = sqliteTable("bakery_products", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    category: text("category").notNull(),       // 'pan' | 'sandwich' | 'hamburguesa' | 'canape' | 'dulce'
    pricingMode: text("pricing_mode").notNull(), // 'unit' | 'kg'
    price: integer("price").notNull(),           // CLP por unidad o por kg
    gramsPerUnit: integer("grams_per_unit"),     // requerido si pricingMode='kg'
    allowsNotes: integer("allows_notes", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
}, (table) => ({
    activeIdx: index("bakery_products_active_idx").on(table.active),
    categoryIdx: index("bakery_products_category_idx").on(table.category),
}));

export const bakeryOrders = sqliteTable("bakery_orders", {
    id: text("id").primaryKey(),                       // ord_xxx
    publicCode: text("public_code").notNull().unique(), // MV-A93K2
    userId: text("user_id").notNull(),                  // customers.id (o '__guest__' si unclaimed)
    scheduledFor: text("scheduled_for").notNull(),      // ISO 8601 con fecha+hora
    method: text("method").notNull(),                   // 'pickup' | 'delivery'
    address: text("address"),
    generalNotes: text("general_notes"),
    status: text("status").notNull().default("pending"),
    // pending | confirmed | preparing | ready | delivered | cancelled
    subtotal: integer("subtotal").notNull(),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    total: integer("total").notNull(),
    contactPhone: text("contact_phone"),
    // Integración POSVECI (encargos presenciales empujados desde el POS).
    externalOrderId: text("external_order_id").unique(), // posveci_{preorder_id} — idempotencia
    source: text("source").notNull().default("web"),    // 'web' | 'posveci_presencial'
    paymentMethod: text("payment_method"),               // Efectivo | Tarjeta | Transferencia (snapshot)
    deposit: integer("deposit").notNull().default(0),    // abono cobrado en POSVECI
    // Detalle real de entrega (POSVECI lo manda al pasar a 'delivered'): total real,
    // saldo pagado + medio, y peso/cantidad real por ítem. JSON camelCase. Null hasta entregar.
    deliveryDetail: text("delivery_detail", { mode: "json" }),
    // Guest orders: cuando POSVECI manda un cliente sin match en miniveci,
    // userId = '__guest__' y guardamos identificadores para claim posterior.
    unclaimed: integer("unclaimed", { mode: "boolean" }).notNull().default(false),
    guestRut: text("guest_rut"),
    guestEmail: text("guest_email"),    // lowercased
    guestPhone: text("guest_phone"),    // normalizado (solo dígitos + '+' opcional)
    guestName: text("guest_name"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
}, (table) => ({
    userCreatedIdx: index("bakery_orders_user_created_idx").on(table.userId, table.createdAt),
    statusScheduledIdx: index("bakery_orders_status_scheduled_idx").on(table.status, table.scheduledFor),
    scheduledIdx: index("bakery_orders_scheduled_idx").on(table.scheduledFor),
    externalOrderIdIdx: uniqueIndex("bakery_orders_external_order_id_unq").on(table.externalOrderId),
    unclaimedIdx: index("bakery_orders_unclaimed_idx").on(table.unclaimed),
    guestRutIdx: index("bakery_orders_guest_rut_idx").on(table.guestRut),
    guestEmailIdx: index("bakery_orders_guest_email_idx").on(table.guestEmail),
    guestPhoneIdx: index("bakery_orders_guest_phone_idx").on(table.guestPhone),
}));

/** Sentinel para `bakery_orders.userId` cuando el encargo presencial no matchea
 * ningún customer. El claim posterior reasigna userId al customer real. */
export const BAKERY_GUEST_USER_ID = "__guest__";

export const bakeryOrderItems = sqliteTable("bakery_order_items", {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => bakeryOrders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(), // sin FK para preservar histórico aunque borren producto
    // SNAPSHOT del producto al momento de crear el encargo:
    productName: text("product_name").notNull(),
    pricingMode: text("pricing_mode").notNull(),
    unitPrice: integer("unit_price").notNull(),
    gramsPerUnit: integer("grams_per_unit"),
    quantity: integer("quantity").notNull(),
    notes: text("notes"),
    subtotal: integer("subtotal").notNull(),
}, (table) => ({
    orderIdx: index("bakery_order_items_order_idx").on(table.orderId),
}));

export const bakeryConfig = sqliteTable("bakery_config", {
    key: text("key").primaryKey(),
    value: text("value").notNull(), // JSON o string según corresponda
});

// Categorías de amasandería (dinámicas, creables desde el admin).
// bakeryProducts.category guarda el `slug` de aquí.
export const bakeryCategories = sqliteTable("bakery_categories", {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
}, (table) => ({
    slugIdx: uniqueIndex("bakery_categories_slug_idx").on(table.slug),
    activeIdx: index("bakery_categories_active_idx").on(table.active),
}));

export const bakeryOrdersRelations = relations(bakeryOrders, ({ many, one }) => ({
    items: many(bakeryOrderItems),
    customer: one(customers, { fields: [bakeryOrders.userId], references: [customers.id] }),
}));

export const bakeryOrderItemsRelations = relations(bakeryOrderItems, ({ one }) => ({
    order: one(bakeryOrders, { fields: [bakeryOrderItems.orderId], references: [bakeryOrders.id] }),
}));

// --- MOBILE AUTH (JWT con refresh tokens revocables) ---
// Los access tokens son JWT firmados sin estado. Los refresh tokens también
// son JWT pero su `jti` se guarda aquí para poder revocarlos (logout) y
// rotarlos. `userType` indica de qué tabla viene el `userId`.

export const refreshTokens = sqliteTable("refresh_tokens", {
    jti: text("jti").primaryKey(),
    userId: text("user_id").notNull(),
    userType: text("user_type").notNull(), // 'customer' | 'admin'
    expiresAt: text("expires_at").notNull(),
    revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
}, (table) => ({
    userIdx: index("refresh_tokens_user_idx").on(table.userId),
    expiresIdx: index("refresh_tokens_expires_idx").on(table.expiresAt),
}));

// --- PUSH NOTIFICATIONS (FCM) ---
// Tokens de dispositivo registrados por la app Flutter para recibir notificaciones
// de cambios de estado de pedidos (bakery + store). 1 user puede tener N tokens
// (multi-device, reinstalls, etc).

export const userPushTokens = sqliteTable("user_push_tokens", {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
    token: text("token").notNull(),
    platform: text("platform").notNull().default("android"), // 'android' | 'ios'
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
}, (table) => ({
    userTokenUnique: uniqueIndex("user_push_tokens_user_token_idx").on(table.userId, table.token),
    userIdx: index("user_push_tokens_user_idx").on(table.userId),
}));

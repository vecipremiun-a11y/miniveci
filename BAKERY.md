# Módulo Amasandería (encargos a futuro)

Módulo **independiente** del módulo Tienda. Comparten DB (Turso) pero
tablas, endpoints, estado y carrito separados.

* **Tienda**: compra inmediata, stock real-time
* **Amasandería**: encargo para fecha+hora futura, sin stock

## Stack

* Next.js (App Router) + Drizzle ORM sobre Turso (libSQL)
* Auth dual: cookie de NextAuth (web) + `Authorization: Bearer <jwt>` (app
  Flutter). El JWT se verifica con `jose` usando `NEXTAUTH_SECRET`.
* SSE en Node runtime para tiempo real admin (en multi-instancia migrar a
  Upstash Redis pub/sub).
* Precios en CLP enteros (INTEGER), nunca floats.

## Tablas

* `bakery_products` — catálogo (unit/kg)
* `bakery_orders` — encargo (status, scheduled_for, method, totales)
* `bakery_order_items` — items con **snapshot** de precio/pricing_mode/grams
* `bakery_config` — key/value (anticipación, horario, slots, delivery)

Migraciones y seeds: [scripts/create-bakery-tables.mjs](scripts/create-bakery-tables.mjs)

```bash
node scripts/create-bakery-tables.mjs
```

Idempotente: las tablas usan `CREATE TABLE IF NOT EXISTS`, la config con
`ON CONFLICT(key) DO NOTHING`, y los productos de ejemplo solo si la tabla
está vacía.

## Configuración (tabla `bakery_config`)

| Key             | Tipo            | Default | Descripción                              |
|-----------------|-----------------|---------|------------------------------------------|
| min_hours_ahead | int             | 12      | Anticipación mínima de horas             |
| max_days_ahead  | int             | 14      | Hasta cuántos días a futuro              |
| closed_weekdays | JSON `number[]` | `[]`    | ISO weekday cerrado (1=lunes…7=domingo)  |
| open_hour       | int 0-23        | 7       | Hora de apertura                         |
| close_hour      | int 1-24        | 20      | Hora de cierre                           |
| slot_minutes    | int             | 30      | Tamaño del slot                          |
| offers_delivery | bool            | true    | Habilita método delivery                 |
| delivery_fee    | int (CLP)       | 1500    | Costo de delivery                        |

Editable desde `PATCH /api/admin/bakery/config` o directo en SQL.

## Endpoints

### Públicos / cliente autenticado

| Método | Ruta                                  | Auth |
|--------|---------------------------------------|------|
| GET    | `/api/bakery/products[?category=]`    | —    |
| GET    | `/api/bakery/config`                  | —    |
| GET    | `/api/bakery/availability?date=YYYY-MM-DD` | —    |
| POST   | `/api/bakery/orders`                  | ✓    |
| GET    | `/api/bakery/orders[?status=&limit=&cursor=]` | ✓ |
| GET    | `/api/bakery/orders/:id`              | ✓    |

### Admin (rol admin)

| Método | Ruta                                            |
|--------|-------------------------------------------------|
| GET    | `/api/admin/bakery/orders[?status=,&date=,&search=]` |
| GET    | `/api/admin/bakery/orders/stream` (SSE)         |
| PATCH  | `/api/admin/bakery/orders/:id/status`           |
| GET/POST/PATCH/DELETE | `/api/admin/bakery/products[/:id]`   |
| PATCH  | `/api/admin/bakery/config`                      |

DELETE de producto es **soft delete** (`active=0`) para preservar
snapshots históricos en `bakery_order_items`.

### Transiciones de estado válidas

```
pending    → confirmed | cancelled
confirmed  → preparing | cancelled
preparing  → ready     | cancelled
ready      → delivered | cancelled
delivered  → (terminal)
cancelled  → (terminal)
```

## Cálculo de precios (autoridad final server-side)

`lib/bakery.ts` → `calcItemSubtotal(product, quantity)`:

```ts
// unit
return product.price * quantity;

// kg
const grams = quantity * product.gramsPerUnit;
const kg = grams / 1000;
return Math.round(kg * product.price);
```

* `subtotal` = suma de `calcItemSubtotal` por línea
* `deliveryFee` = `cfg.deliveryFee` si `method=delivery`, si no `0`
* `total` = `subtotal + deliveryFee`

**Nunca** confiar en el subtotal/total que envíe el cliente.

## SSE para admin

`GET /api/admin/bakery/orders/stream` (Node runtime):

```
event: ready
data: { ok: true }

event: order.created
data: { order: BakeryOrder, occurredAt }

event: order.status_changed
data: { orderId, publicCode, status, previousStatus, occurredAt }

: keepalive   (cada 25s)
```

Cliente:

```ts
const es = new EventSource("/api/admin/bakery/orders/stream");
es.addEventListener("order.created", (e) => { ... });
es.addEventListener("order.status_changed", (e) => { ... });
```

Broker en memoria: [lib/bakery-live-updates.ts](lib/bakery-live-updates.ts).
Para multi-instancia migrar a Upstash Redis pub/sub o Vercel KV.

## Notificaciones al cliente (placeholders)

* WhatsApp (Twilio/n8n) — **TODO**, dejar hook en `lib/bakery-notifications.ts`
* Push FCM (app Flutter) — **TODO**, hook similar

Por ahora el endpoint `POST /api/bakery/orders` devuelve la order completa
y la web/app muestra confirmación local.

## Auth dual (web + Flutter)

`lib/bakery-auth.ts` → `getBakeryUser(req)`:

1. Si la request trae `Authorization: Bearer <token>`, intenta verificar con
   `jose.jwtVerify` usando `NEXTAUTH_SECRET`. El payload debe incluir
   `sub` (o `id`) y opcionalmente `role`.
2. Si no, intenta la sesión cookie de NextAuth.

Para que la app Flutter funcione, hay que **emitir** un JWT en algún
endpoint tipo `/api/auth/mobile/login` (no incluido aún). Estructura
recomendada del payload:

```json
{ "sub": "<customer.id>", "role": "customer", "email": "...", "exp": ... }
```

## Forma del JSON (compatible con Flutter)

```ts
BakeryProduct {
  id, name, description, imageUrl, category,
  pricingMode: 'unit'|'kg', price, gramsPerUnit, allowsNotes,
  active, sortOrder
}

BakeryOrder {
  id, publicCode, userId, scheduledFor (ISO 8601),
  method: 'pickup'|'delivery', address, generalNotes,
  status, items: BakeryOrderItem[],
  subtotal, deliveryFee, total,
  contactPhone, createdAt, updatedAt
}

BakeryOrderItem {
  id, productId, productName,
  pricingMode, unitPrice, gramsPerUnit, quantity, notes, subtotal
}
```

Snake_case se convierte a camelCase en la serialización
(`lib/bakery.ts` → `serializeProduct`, `serializeOrder`).

## Panel admin

`/admin/encargos` ([app/admin/encargos/page.tsx](app/admin/encargos/page.tsx)):

* Lista con filtros estado/fecha/búsqueda
* Cards con código público grande, fecha+hora, método, total, cliente
* Botones de acción rápida (Confirmar → Empezar → Listo → Entregado)
* Detalle lateral con items, notas, dirección, peso estimado en panes
* **SSE en vivo** + toast con sonido al recibir `order.created`
* Badge de conexión "● conectado" / "○ reconectando"

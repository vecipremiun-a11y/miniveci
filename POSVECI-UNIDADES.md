# Unidades de medida (Caja, Bandeja, Pack…) — POSVECI ⇄ Tienda

Qué resuelve: un mismo producto se vende por unidad y también por "unidad de
medida" (Caja de 30, Bandeja de 15, Pack de 6…). La tienda (web y app) copia la
regla del POS, guarda sus propias presentaciones y además recibe las del POS en
el sync de productos. Los dos sistemas siguen independientes: solo comparten la
información.

Todo es aditivo: si POSVECI no manda nada nuevo, la tienda funciona igual que
antes (con las presentaciones que se creen en su admin).

---

## 1. La regla (la misma del POS)

- **El stock vive siempre en unidades.** Una presentación solo dice cuántas
  unidades trae y a cuánto se vende entera. 2 cajas de 30 = 60 unidades menos.
- Solo productos por unidad (`unit` = `Und`). Los de peso (Kg/Lt) no tienen.
- `units`: entero, mínimo 2.
- `price`: precio de la presentación entera, IVA incluido, pesos enteros, y
  **divisible exacto por `units`** (7.500 / 30 = 250 sí; 7.600 / 30 no). Si no
  divide, se rechaza y se sugieren `floor(price/units)*units` y
  `ceil(price/units)*units`.
- `barcode`: opcional. Único entre presentaciones y distinto del SKU de
  cualquier producto.
- El precio de la presentación es **fijo**: sin escala de precios, sin grupo de
  escala, sin oferta (ni gasta `offer_stock`) y sin precio de socio.
- Para vender una caja tiene que alcanzar el stock para la caja entera. En un
  pedido se suma todo lo del producto: sueltas + cajas × units ≤ stock.

---

## 2. Sync de productos: campo `presentations`

En el mismo `POST` (o `PUT`) `https://<tienda>/api/pos/products/sync` de
siempre, con los mismos headers (`x-api-key` / `x-api-secret`), se agrega un
campo opcional. También lo acepta el webhook `product.created` /
`product.updated` (`/api/webhooks/poskem`).

```json
{
  "sku": "7801234567890",
  "pos_product_id": 500,
  "name": "Ariztia Huevo Extra",
  "price": 300,
  "stock": 800,
  "unit": "Und",
  "presentations": [
    { "pos_presentation_id": "12", "name": "Caja",    "units": 30, "price": 7500, "barcode": "656885587", "is_active": true },
    { "pos_presentation_id": "15", "name": "Bandeja", "units": 15, "price": 4500, "barcode": null,        "is_active": true }
  ]
}
```

| Campo | Obligatorio | Qué es |
|---|---|---|
| `pos_presentation_id` | sí | Id de la presentación en POSVECI (número o texto). Alias: `posPresentationId` |
| `name` | sí | "Caja", "Bandeja", "Pack"… (hasta 40 letras) |
| `units` | sí | Unidades que trae. Entero ≥ 2 |
| `price` | sí | Precio de la presentación entera, divisible por `units` |
| `barcode` | no | Código de barras de la presentación. `null` = sin código |
| `is_active` | no (default `true`) | Alias: `isActive`. `false` = no se vende en la tienda |

**Semántica** (igual que `tier_group` y las direcciones de clientes):

- **Ausente o `null` = no tocar nada.** Un sync de stock o precio sin el campo
  deja las presentaciones como están.
- **Array (aunque sea `[]`) = la lista COMPLETA** de presentaciones del POS para
  ese producto:
  - upsert por (producto, `pos_presentation_id`): nombre, unidades, precio,
    código y activo;
  - las del POS que no vengan se borran (`[]` borra todas las del POS);
  - las creadas en la tienda **nunca** se tocan, y tampoco "Mostrar en la
    tienda" (eso lo decide solo la tienda).
- Idempotente: mandar lo mismo dos veces no cambia nada.

**Validación.** Cada presentación se valida sola. La que no cumple (unidades,
precio no divisible, código repetido con otra presentación, producto que no es
por unidad…) se salta **sin hacer fallar el sync del producto** y se informa. Si
esa presentación ya existía en la tienda, se borra: la tienda no sigue vendiendo
una versión que el POS ya cambió.

**Respuesta** (solo cuando vino el campo):

```json
{
  "success": true,
  "action": "updated",
  "product": { "id": "…", "sku": "7801234567890" },
  "presentations": {
    "upserted": 1,
    "unchanged": 1,
    "deleted": 0,
    "skipped": [
      { "pos_presentation_id": "16", "error": "$7.600 no se divide exacto en 30 unidades ($253,33 c/u) y la boleta no cuadraría. Usa $7.590 o $7.620." }
    ]
  }
}
```

**Cuándo mandarlo:** cada vez que en el POS se crea, edita o borra una unidad de
medida; cuando una compra le cambia el precio; y en una carga inicial de todos
los productos. Mandar siempre la lista completa del producto.

---

## 3. Pedidos de la tienda → POSVECI: `presentation` en cada ítem

Mismo `POST` a `POSVECI_PREORDERS_URL` con `order_type: "store"` de siempre.
**Cada ítem sigue yendo en UNIDADES**: es lo que el POS separa de stock y
factura. Si se vendió por presentación, se agrega el objeto opcional
`presentation`:

```json
{
  "product_external_id": "500",
  "product_name": "Ariztia Huevo Extra",
  "quantity": 60,
  "unit_price": 250,
  "line_subtotal": 15000,
  "presentation": {
    "pos_presentation_id": "12",
    "name": "Caja",
    "units": 30,
    "quantity": 2,
    "price": 7500
  }
}
```

- Siempre se cumple `quantity = presentation.quantity × presentation.units` y
  `unit_price × quantity = line_subtotal`.
- `pos_presentation_id` = `null` si la presentación es propia de la tienda (no
  existe en el POS). Igual trae nombre, unidades, cantidad y precio.
- La cantidad y el precio son una foto del momento de la venta: si después se
  borra o cambia la presentación, el pedido no cambia.
- Un mismo producto puede venir en dos ítems: uno por presentación y otro por
  unidades sueltas (ej. 2 cajas + 3 sueltas).

**Hoy POSVECI puede ignorar el campo** y recibe 60 unidades a $250, que es
correcto para stock y boleta. Después lo puede usar para mostrar
"2 Caja (30 und) × $7.500" en su pestaña Tienda y en el ticket.

El acuerdo de stock no cambia: la tienda descuenta de su copia las 60 unidades
cuando el pedido queda firme, y POSVECI separa las suyas al recibirlo.

---

## 4. Qué NO viaja

- Las presentaciones creadas en el admin de la tienda **no** se mandan al POS.
- "Mostrar en la tienda" (`hidden_in_store`) es solo de la tienda.

---

## 5. App móvil (contrato de la tienda, para referencia)

Aditivo; la app actual lo ignora y no se rompe.

- `GET /api/store/products` y `/api/store/products/{slug}`: campo
  `presentations: [{ id, name, units, price }]`, solo las activas y visibles, de
  la más chica a la más grande. Está agotada si `stock < units`.
- `POST /api/store/orders` (Bearer): cada ítem acepta `presentationId`
  opcional. Con él, `quantity` es **cuántas presentaciones** (cajas). El
  servidor pone el precio desde la base (nunca usa el del cliente) y guarda el
  renglón en unidades.
- Respuesta y `GET /api/store/orders`: cada ítem trae `presentation:
  { id, name, units, quantity, price }` o `null`; `quantity` del ítem sigue en
  unidades.

---

## 6. Puesta en marcha (tienda)

1. `npm run db:migrate:presentations` (migración 0029: tabla
   `product_presentations` + columnas `presentation_*` en `order_items`).
   Aditiva: el código anterior sigue funcionando con ella aplicada. **Correrla
   antes de desplegar** el código nuevo, que ya lee esas columnas.
2. Desplegar.
3. POSVECI: carga inicial con `presentations` de todos los productos que tengan.

# Sincronización del árbol de categorías (POSVECI → Tienda)

Qué resuelve: la tienda mostraba las categorías como una lista plana en orden
alfabético, porque el sync de productos solo manda el **nombre** de la categoría
(`category`, texto suelto) y con eso no hay forma de saber de quién cuelga cada
una. POSVECI sí tiene el árbol desde su migración `0024_categorias_jerarquia.sql`.

La llave del sync es el **id de la categoría en POSVECI**, no el nombre: el nombre
cambia, y además las tildes lo rompían (el generador de slug convirtió
"Estantería" en `estanter-a` y dejó la categoría duplicada en la tienda).

---

## 1. Endpoint: el árbol completo

```
POST (o PUT) https://<tienda>/api/pos/categories/sync
```

**Headers** (los mismos de los demás `/api/pos/*`):

```
Content-Type: application/json
x-api-key: <client_id>
x-api-secret: <client_secret>
```

**Body** — el árbol entero en un solo envío:

```json
{
  "categories": [
    { "posCategoryId": 10, "name": "Amasanderia", "parentPosCategoryId": null, "active": true, "sortOrder": 0 },
    { "posCategoryId": 11, "name": "Panes",       "parentPosCategoryId": 10 },
    { "posCategoryId": 12, "name": "Empanadas",   "parentPosCategoryId": 10 },
    { "posCategoryId": 13, "name": "Integrales",  "parentPosCategoryId": 11 }
  ],
  "deactivateMissing": false
}
```

También se acepta el arreglo pelado como body (`[ {...}, {...} ]`).

| Campo | Obligatorio | Qué es |
|---|---|---|
| `posCategoryId` | sí | `categories.id` de POSVECI. Acepta número o texto. Alias: `pos_category_id`, `id` |
| `name` | sí | Nombre visible |
| `parentPosCategoryId` | no | `categories.parent_id` de POSVECI. `null` = primer nivel. Alias: `parent_pos_category_id`, `parentId`, `parent_id` |
| `active` | no (default `true`) | Si no viene, se puede mandar `status: "active"` |
| `sortOrder` | no | Orden entre hermanas. Alias: `sort_order` |
| `deactivateMissing` | no (default `false`) | `true` desactiva en la tienda las categorías con id de POSVECI que no vengan en este envío. Dejarlo en `false` mientras se manden envíos parciales |

**Respuesta**

```json
{
  "success": true,
  "message": "Árbol de categorías sincronizado",
  "received": 4, "created": 3, "updated": 1,
  "adopted": 1, "parentsLinked": 3, "deactivated": 0
}
```

- `adopted`: categorías que ya existían en la tienda y recién ahora quedaron
  atadas a su id de POSVECI (no se duplicaron).
- `parentsLinked`: cuántas quedaron colgando de su padre.

**Detalles que conviene saber**

- Manda el árbol **completo** en cada envío, no solo la rama que cambió: los
  padres se atan en una segunda pasada, y si el padre no viene en el mismo envío
  la categoría queda en primer nivel.
- Es idempotente: mandar dos veces lo mismo no duplica nada.
- Las categorías que ya existían en la tienda se reutilizan (se buscan por id de
  POSVECI, después por nombre sin tildes y después por slug), así que las 44
  actuales no se duplican.
- Los nombres repetidos se resuelven quedándose con la categoría que tiene más
  productos, que es la que la tienda está usando.

---

## 2. Sync de productos: mandar también el id de la categoría

En `PUT /api/pos/products/sync`, junto al `category` de siempre, agregar:

```json
{
  "sku": "12345",
  "name": "Hallulla",
  "category": "Panes",
  "posCategoryId": 11
}
```

Alias aceptado: `pos_category_id`. El nombre puede seguir viajando (se usa de
respaldo para los productos que todavía llegan sin id), pero **cuando viene el
id, manda el id**: es lo que ata el producto a la rama correcta del árbol.

---

## 3. Orden recomendado para la primera carga

1. `POST /api/pos/categories/sync` con el árbol completo.
2. Reenviar los productos con `posCategoryId` (o esperar al sync normal).

Después de eso, la tienda muestra las categorías con su jerarquía y al elegir una
trae toda su rama, igual que el inventario del POS: elegir "Amasandería" trae lo
suyo más Panes, Empanadas y las hijas de esas.

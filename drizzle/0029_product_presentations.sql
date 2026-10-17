-- Unidades de medida (presentaciones): Caja de 30, Bandeja de 15, Pack de 6…
--
-- Igual que en POSVECI, el stock vive SIEMPRE en unidades: una presentación solo
-- dice cuántas unidades trae y a cuánto se vende entera. Vender 2 cajas de 30 =
-- 60 unidades menos de stock. Solo para productos por unidad (unit 'Und').
--
-- product_presentations:
--   source 'pos'   → llega en el sync de POSVECI (pos_presentation_id = su id). El
--                    POS es dueño de nombre, unidades, precio, código y activo.
--   source 'store' → creada en el admin de miniveci. No viaja al POS.
--   price          → precio de la presentación entera, IVA incluido, y divisible
--                    exacto por units (la boleta va en unidades: 60 × $250).
--   hidden_in_store→ solo de miniveci: ocultarla en la web. El sync no la toca.
-- La regla vive en lib/product-presentations.ts; el sync en lib/presentation-sync.ts.
CREATE TABLE IF NOT EXISTS product_presentations (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'store',
    pos_presentation_id TEXT,
    name TEXT NOT NULL,
    units INTEGER NOT NULL,
    price INTEGER NOT NULL,
    barcode TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    hidden_in_store INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS product_presentations_product_idx ON product_presentations (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_presentations_pos_unq ON product_presentations (product_id, pos_presentation_id) WHERE pos_presentation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_presentations_barcode_unq ON product_presentations (barcode) WHERE barcode IS NOT NULL;

-- Renglón de pedido vendido por presentación. quantity sigue en UNIDADES
-- (cajas × units) y unit_price = price / units, para que stock, totales,
-- reportes y POSVECI sigan igual. Estas columnas son la foto de la presentación
-- al vender (NULL en los renglones por unidad). Sin FK: si después se borra la
-- presentación, el pedido no se toca.
ALTER TABLE order_items ADD COLUMN presentation_id TEXT;
ALTER TABLE order_items ADD COLUMN presentation_pos_id TEXT;
ALTER TABLE order_items ADD COLUMN presentation_name TEXT;
ALTER TABLE order_items ADD COLUMN presentation_units INTEGER;
ALTER TABLE order_items ADD COLUMN presentation_qty INTEGER;
ALTER TABLE order_items ADD COLUMN presentation_price INTEGER;

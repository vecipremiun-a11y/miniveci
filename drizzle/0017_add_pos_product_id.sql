-- ID interno permanente del producto en POSVECI (llave maestra del sync).
-- El SKU/código de barras es mutable; este no. Matchear por aquí evita
-- duplicados cuando el cajero cambia el código de barras en POSVECI.
ALTER TABLE products ADD COLUMN pos_product_id TEXT;

CREATE INDEX IF NOT EXISTS products_pos_product_id_idx ON products(pos_product_id);

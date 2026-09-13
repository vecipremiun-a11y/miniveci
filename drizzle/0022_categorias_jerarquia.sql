-- Jerarquía de categorías que viene de POSVECI: categoría → subcategoría → hija.
--
-- `parent_id` ya existía en la tabla, pero nunca se llenó: las 44 categorías lo
-- tienen en NULL porque el sync de productos solo recibe el NOMBRE de la
-- categoría (`category`, texto suelto) y con eso no hay forma de saber de quién
-- cuelga. POSVECI sí tiene el árbol desde su migración 0024.
--
-- `pos_category_id` es la llave maestra del sync, igual que products.pos_product_id:
-- el nombre puede cambiar y además lo rompen las tildes —el generador de slug
-- convirtió "Estantería" en `estanter-a` y dejó una categoría duplicada—, el id
-- de POSVECI no cambia nunca.
ALTER TABLE categories ADD COLUMN pos_category_id TEXT;

-- Único para que un mismo id de POSVECI no pueda quedar en dos categorías.
-- SQLite permite varios NULL en un índice único, así que las categorías creadas
-- a mano en la web (sin id de POS) conviven sin problema.
CREATE UNIQUE INDEX IF NOT EXISTS categories_pos_category_id_idx ON categories(pos_category_id);

-- El árbol se arma pidiendo las hijas de una categoría.
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories(parent_id);

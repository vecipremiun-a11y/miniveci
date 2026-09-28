-- Grupo de escala de precios.
--
-- Productos distintos con el mismo `tier_group` (ej. "Ilicit tintura") suman
-- cantidad para la escala: 1 negro + 1 castaño + 1 cobrizo cuentan como 3 y
-- cada uno paga el tramo de 3 unidades. NULL = sin grupo, cada producto cuenta
-- solo lo suyo, como hasta ahora.
--
-- Lo edita el admin en la ficha del producto; el sync de POSVECI no lo toca.
ALTER TABLE products ADD COLUMN tier_group TEXT;

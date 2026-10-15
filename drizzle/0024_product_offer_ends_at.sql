-- Fin programado de la oferta de un producto.
--
-- Fecha y hora (ISO 8601 en UTC) en que la oferta se apaga sola: desde ese
-- momento el producto se vende a su precio normal, aunque is_offer siga en 1
-- (POSVECI puede volver a mandarlo así en cada sync). NULL = la oferta no vence.
-- La regla vive en lib/product-price.ts → isOfferActive.
ALTER TABLE products ADD COLUMN offer_ends_at TEXT;

-- Oferta por stock de un producto.
--
-- Unidades (kg en los productos de peso) que quedan a precio oferta. Cada venta
-- web a precio oferta las descuenta; POSVECI manda el saldo de las ventas en
-- tienda. En 0 la oferta se acaba sola y el producto vuelve a su precio normal,
-- aunque is_offer siga en 1. NULL = la oferta no tiene límite de stock.
-- La regla vive en lib/product-price.ts → isOfferActive.
ALTER TABLE products ADD COLUMN offer_stock REAL;

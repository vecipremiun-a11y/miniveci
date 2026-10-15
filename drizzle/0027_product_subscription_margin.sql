-- Precio suscriptor automático.
--
-- subscription_price ya no se escribe a mano: es (costo + IVA) × (1 + utilidad)
-- y se recalcula cada vez que cambia el costo, el IVA o la utilidad, desde el
-- admin o desde POSVECI. subscription_margin es la utilidad de ese producto en
-- %; NULL = la de todos (5%, DEFAULT_SUBSCRIPTION_MARGIN en lib/product-price.ts).
ALTER TABLE products ADD COLUMN subscription_margin REAL;

-- Recalcular todos los productos con costo (npm run db:migrate:subscription-margin -- --recalcular).
UPDATE products SET subscription_price =
    CAST(ROUND(ROUND(cost_price * (1 + CASE WHEN tax_rate > 0 THEN tax_rate ELSE 0 END / 100.0))
        * (1 + COALESCE(subscription_margin, 5) / 100.0)) AS INTEGER)
WHERE cost_price > 0;

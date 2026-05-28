-- Anticipación mínima por producto de amasandería (horas). null/0 → usa el general.
ALTER TABLE bakery_products ADD COLUMN lead_time_hours INTEGER;

-- Baja el mínimo general a 4h (la mayoría de los panes salen en ese rango).
INSERT INTO bakery_config (key, value) VALUES ('min_hours_ahead', '4')
    ON CONFLICT(key) DO UPDATE SET value = '4';

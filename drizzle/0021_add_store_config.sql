-- Configuración de la tienda en clave/valor (mismo patrón que bakery_config).
-- Primer uso: condiciones de envío, que estaban hardcodeadas en el código.
CREATE TABLE IF NOT EXISTS store_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT
);

-- Valores de partida: los mismos que estaban en duro, para que nada cambie
-- de comportamiento al desplegar. 0 en el umbral = envío gratis desactivado.
INSERT INTO store_config (key, value) VALUES ('delivery_fee', '1990')
    ON CONFLICT(key) DO NOTHING;
INSERT INTO store_config (key, value) VALUES ('free_delivery_threshold', '0')
    ON CONFLICT(key) DO NOTHING;

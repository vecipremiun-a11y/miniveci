-- Categorías dinámicas de amasandería (antes eran un enum fijo en código).
-- bakery_products.category guarda el `slug` de aquí.
CREATE TABLE IF NOT EXISTS bakery_categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS bakery_categories_slug_idx ON bakery_categories(slug);
CREATE INDEX IF NOT EXISTS bakery_categories_active_idx ON bakery_categories(active);

-- Seed de las categorías originales (slugs deben coincidir con los valores ya guardados en bakery_products.category)
INSERT OR IGNORE INTO bakery_categories (id, slug, label, sort_order, active, created_at) VALUES
    ('bcat_pan',        'pan',         'Pan',         0, 1, '2026-05-26T00:00:00.000Z'),
    ('bcat_sandwich',   'sandwich',    'Sándwich',    1, 1, '2026-05-26T00:00:00.000Z'),
    ('bcat_hamburguesa','hamburguesa', 'Hamburguesa', 2, 1, '2026-05-26T00:00:00.000Z'),
    ('bcat_canape',     'canape',      'Canapé',      3, 1, '2026-05-26T00:00:00.000Z'),
    ('bcat_dulce',      'dulce',       'Dulce',       4, 1, '2026-05-26T00:00:00.000Z');

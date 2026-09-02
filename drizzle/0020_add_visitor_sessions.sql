-- Presencia de visitantes para el panel de soporte: quién está navegando el
-- sitio ahora mismo, desde dónde y en qué página. Una fila por `guest_id`
-- (el mismo UUID que usa el widget de chat), pisada por cada heartbeat.
CREATE TABLE IF NOT EXISTS chat_visitor_sessions (
    id TEXT PRIMARY KEY,
    guest_id TEXT NOT NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    page_views INTEGER NOT NULL DEFAULT 1,
    current_path TEXT,
    page_title TEXT,
    landing_path TEXT,
    referrer TEXT,
    ip TEXT,
    country TEXT,
    country_region TEXT,
    city TEXT,
    timezone TEXT,
    latitude REAL,
    longitude REAL,
    user_agent TEXT,
    device TEXT,
    browser TEXT,
    os TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Único: el upsert del heartbeat resuelve el conflicto por guest_id.
CREATE UNIQUE INDEX IF NOT EXISTS visitor_sessions_guest_id_idx ON chat_visitor_sessions(guest_id);
-- La lista de "en línea" filtra por last_seen_at reciente.
CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx ON chat_visitor_sessions(last_seen_at);
CREATE INDEX IF NOT EXISTS visitor_sessions_customer_idx ON chat_visitor_sessions(customer_id);

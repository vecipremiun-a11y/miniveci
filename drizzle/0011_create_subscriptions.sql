CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'premium',
    status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    price INTEGER NOT NULL,
    payment_method TEXT,
    payment_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS subscription_customer_id_idx ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS subscription_status_idx ON subscriptions(status);

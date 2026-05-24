-- Encargos presenciales creados en POSVECI y empujados a miniveci.
-- Soporta:
--  (a) Idempotencia: external_order_id UNIQUE evita duplicar si POSVECI reintenta.
--  (b) Identificar origen (web vs presencial) sin romper queries existentes.
--  (c) "Guest orders": cuando POSVECI manda un cliente que no matchea ninguna
--      cuenta miniveci, guardamos los identificadores y user_id='__guest__'.
--      Cuando el cliente se registra o agrega rut/email/phone, el claim los
--      reasigna a su cuenta (ver lib/pos-customer-match.ts).

ALTER TABLE bakery_orders ADD COLUMN external_order_id TEXT;
ALTER TABLE bakery_orders ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
ALTER TABLE bakery_orders ADD COLUMN unclaimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bakery_orders ADD COLUMN guest_rut TEXT;
ALTER TABLE bakery_orders ADD COLUMN guest_email TEXT;
ALTER TABLE bakery_orders ADD COLUMN guest_phone TEXT;
ALTER TABLE bakery_orders ADD COLUMN guest_name TEXT;
ALTER TABLE bakery_orders ADD COLUMN payment_method TEXT;
ALTER TABLE bakery_orders ADD COLUMN deposit INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS bakery_orders_external_order_id_unq
    ON bakery_orders(external_order_id);

CREATE INDEX IF NOT EXISTS bakery_orders_unclaimed_idx
    ON bakery_orders(unclaimed);

CREATE INDEX IF NOT EXISTS bakery_orders_guest_rut_idx
    ON bakery_orders(guest_rut);

CREATE INDEX IF NOT EXISTS bakery_orders_guest_email_idx
    ON bakery_orders(guest_email);

CREATE INDEX IF NOT EXISTS bakery_orders_guest_phone_idx
    ON bakery_orders(guest_phone);

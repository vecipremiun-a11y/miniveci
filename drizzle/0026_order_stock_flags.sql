-- Stock de pedidos web: una sola vez, y sin pisarse con POSVECI.
--
-- stock_applied_at: cuándo se descontó el stock web del pedido. NULL = no se
--   descontó o ya se devolvió. Evita descontar o devolver dos veces.
-- pos_sent_at: cuándo POSVECI recibió el pedido. Mientras esté NULL, el stock
--   absoluto que manda POSVECI todavía no incluye esa venta y miniveci se la
--   resta (lib/order-stock.ts → pendingWebOrderQty).
ALTER TABLE orders ADD COLUMN stock_applied_at TEXT;
ALTER TABLE orders ADD COLUMN pos_sent_at TEXT;

-- Pedidos anteriores: con la regla vieja el stock se descontaba al salir de
-- "new" a un estado activo, así que esos ya lo tienen descontado.
UPDATE orders SET stock_applied_at = COALESCE(updated_at, created_at)
WHERE status IN ('confirmed', 'paid', 'preparing', 'ready', 'shipped', 'delivered');

-- Y se dan por recibidos en POSVECI, para no restarlos del stock que manda.
UPDATE orders SET pos_sent_at = COALESCE(created_at, updated_at);

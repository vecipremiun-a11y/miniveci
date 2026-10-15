-- "Quiero factura" en el checkout (cualquier medio de pago).
--
-- order_invoices: una fila por pedido que pidió factura (sin fila = boleta). Se
--   guarda al crear el pedido y viaja a POSVECI como `invoice` junto con el
--   pedido; la factura la emite el local. RUT y razón social son obligatorios.
-- customer_invoice_data: los últimos datos de factura del cliente, para
--   precargar el checkout y editarlos en "Mi cuenta". Solo se mandan a POSVECI
--   si el cliente marca "Quiero factura" en ese pedido.
CREATE TABLE IF NOT EXISTS order_invoices (
    order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    rut TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    giro TEXT,
    direccion TEXT,
    comuna TEXT,
    ciudad TEXT,
    email TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_invoice_data (
    customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    rut TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    giro TEXT,
    direccion TEXT,
    comuna TEXT,
    ciudad TEXT,
    email TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

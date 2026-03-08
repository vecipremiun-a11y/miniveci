import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const targetSku = "65432656";
const targetStock = 20;

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

async function run() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env.local");
  }

  const client = createClient({ url, authToken });

  const credsRs = await client.execute("SELECT client_id, client_secret FROM api_credentials WHERE id = 'main' LIMIT 1");
  if (credsRs.rows.length === 0) {
    throw new Error("No hay credenciales en api_credentials (id='main').");
  }

  const credentials = credsRs.rows[0] as any;
  const apiKey = String(credentials.client_id);
  const apiSecret = String(credentials.client_secret);
  const normalizedSku = normalizeSku(targetSku);

  console.log(`Enviando SKU: [${normalizedSku}]`);

  const beforeRs = await client.execute({
    sql: "SELECT id, sku, name, web_stock FROM products WHERE UPPER(TRIM(sku)) = ? LIMIT 1",
    args: [normalizedSku],
  });

  if (beforeRs.rows.length === 0) {
    throw new Error(`No existe producto con sku(normalizado)=${normalizedSku}`);
  }

  const before = beforeRs.rows[0] as any;

  const response = await fetch(`${baseUrl}/api/pos/products/stock`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-api-secret": apiSecret,
    },
    body: JSON.stringify({ sku: normalizedSku, stock: targetStock }),
  });

  const responseText = await response.text();

  const afterRs = await client.execute({
    sql: "SELECT id, sku, name, web_stock FROM products WHERE UPPER(TRIM(sku)) = ? LIMIT 1",
    args: [normalizedSku],
  });

  const after = afterRs.rows[0] as any;

  console.log(JSON.stringify({
    endpoint: `${baseUrl}/api/pos/products/stock`,
    request: {
      method: "PUT",
      headers: {
        "x-api-key": "[MASKED]",
        "x-api-secret": "[MASKED]",
      },
      body: { sku: normalizedSku, stock: targetStock },
    },
    skuRaw: targetSku,
    skuNormalized: normalizedSku,
    response: {
      status: response.status,
      ok: response.ok,
      body: responseText,
    },
    productBefore: {
      id: String(before.id),
      sku: String(before.sku),
      name: String(before.name),
      web_stock: Number(before.web_stock),
    },
    productAfter: {
      id: String(after.id),
      sku: String(after.sku),
      name: String(after.name),
      web_stock: Number(after.web_stock),
    },
    stockUpdated: Number(after.web_stock) === targetStock,
  }, null, 2));
}

run().catch((error: any) => {
  console.error("TEST_ERROR", error?.message || error);
  process.exit(1);
});

import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sku = process.argv[2] || "65432656";
const intervalMs = Number(process.argv[3] || 3000);

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("❌ Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env.local");
  process.exit(1);
}

if (!Number.isFinite(intervalMs) || intervalMs < 500) {
  console.error("❌ Intervalo inválido. Usa al menos 500ms.");
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  web_stock: number;
  updated_at: string;
};

let lastStock: number | null = null;
let lastUpdatedAt: string | null = null;

function nowLabel() {
  return new Date().toLocaleString("es-CL", { hour12: false });
}

async function readProduct(): Promise<ProductRow | null> {
  const rs = await client.execute({
    sql: "SELECT id, sku, name, web_stock, updated_at FROM products WHERE sku = ? LIMIT 1",
    args: [sku],
  });

  if (rs.rows.length === 0) return null;

  const row = rs.rows[0] as any;
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    web_stock: Number(row.web_stock ?? 0),
    updated_at: String(row.updated_at ?? ""),
  };
}

async function tick() {
  const product = await readProduct();

  if (!product) {
    console.log(`[${nowLabel()}] ⚠️ SKU ${sku} no encontrado`);
    return;
  }

  if (lastStock === null) {
    lastStock = product.web_stock;
    lastUpdatedAt = product.updated_at;
    console.log(`[${nowLabel()}] ▶️ Monitoreando ${product.name} (${product.sku}) | stock=${product.web_stock} | updated_at=${product.updated_at}`);
    return;
  }

  const stockChanged = product.web_stock !== lastStock;
  const updateChanged = product.updated_at !== lastUpdatedAt;

  if (stockChanged || updateChanged) {
    const delta = product.web_stock - (lastStock ?? 0);
    const deltaLabel = delta === 0 ? "sin cambio de stock" : `delta=${delta > 0 ? "+" : ""}${delta}`;
    console.log(`[${nowLabel()}] 🔄 Cambio detectado | stock=${lastStock} -> ${product.web_stock} (${deltaLabel}) | updated_at=${product.updated_at}`);
    lastStock = product.web_stock;
    lastUpdatedAt = product.updated_at;
    return;
  }

  console.log(`[${nowLabel()}] ⏱️ Sin cambios | stock=${product.web_stock}`);
}

async function run() {
  console.log(`\n📡 Live Stock Monitor iniciado`);
  console.log(`   SKU: ${sku}`);
  console.log(`   Intervalo: ${intervalMs}ms`);
  console.log(`   Detener: Ctrl + C\n`);

  await tick();

  const timer = setInterval(() => {
    tick().catch((error) => {
      console.error(`[${nowLabel()}] ❌ Error en monitor:`, error?.message || error);
    });
  }, intervalMs);

  process.on("SIGINT", () => {
    clearInterval(timer);
    console.log(`\n🛑 Monitor detenido por usuario`);
    process.exit(0);
  });
}

run().catch((error) => {
  console.error("❌ No se pudo iniciar el monitor:", error?.message || error);
  process.exit(1);
});

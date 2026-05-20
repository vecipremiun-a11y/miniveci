/**
 * Simula a POSVECI llamando al PATCH inverso para cambiar el estado de un encargo.
 *
 * Uso:
 *   npm run pos:test:patch -- MV-XVKQP preparing
 *   npm run pos:test:patch -- MV-XVKQP cancelled "razón opcional"
 *
 * Lee api_key + api_secret de la fila api_credentials.main de tu Turso DB.
 * Llama PATCH localhost:3000/api/pos/bakery/orders/<publicCode>/status
 * Imprime el response completo para diagnóstico.
 */
import { db } from "../lib/db";
import { apiCredentials } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const VALID_STATUSES = ["confirmed", "preparing", "ready", "delivered", "cancelled"] as const;
type Status = (typeof VALID_STATUSES)[number];

async function main() {
    const [publicCode, status, ...rest] = process.argv.slice(2);
    if (!publicCode || !status) {
        console.error("Uso: npm run pos:test:patch -- <publicCode> <status>");
        console.error(`  status válidos: ${VALID_STATUSES.join(", ")}`);
        process.exit(2);
    }
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
        console.error(`Status inválido: "${status}"`);
        console.error(`  válidos: ${VALID_STATUSES.join(", ")}`);
        process.exit(2);
    }

    const creds = await db.query.apiCredentials.findFirst({
        where: eq(apiCredentials.id, "main"),
    });
    if (!creds?.clientId || !creds?.clientSecret) {
        console.error("\n❌ No hay credenciales en api_credentials.main");
        console.error("   Genéralas desde /admin/configuracion → Integración POS\n");
        process.exit(3);
    }

    const url = `http://localhost:3000/api/pos/bakery/orders/${publicCode}/status`;
    const body = JSON.stringify(rest.length > 0 ? { status, reason: rest.join(" ") } : { status });

    console.log(`→ PATCH ${url}`);
    console.log(`   x-api-key: ${creds.clientId.slice(0, 12)}... (truncado)`);
    console.log(`   body: ${body}\n`);

    const start = Date.now();
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            "x-api-key": creds.clientId,
            "x-api-secret": creds.clientSecret,
            "Content-Type": "application/json",
        },
        body,
    });
    const elapsed = Date.now() - start;
    const text = await res.text();

    console.log(`← ${res.status} ${res.statusText} (${elapsed}ms)\n`);
    try {
        const json = JSON.parse(text);
        console.log(JSON.stringify(json, null, 2));
    } catch {
        console.log(text);
    }

    process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
    console.error("[test-pos-status-patch] error:", err);
    process.exit(1);
});

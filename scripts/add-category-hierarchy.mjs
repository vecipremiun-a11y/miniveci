// Script idempotente para la migración 0022: agrega categories.pos_category_id
// y los índices del árbol de categorías.
// Uso: node scripts/add-category-hierarchy.mjs
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
    process.exit(1);
}

const client = createClient({ url, authToken });

try {
    const columns = await client.execute("SELECT name FROM pragma_table_info('categories')");
    const hasColumn = (name) => columns.rows.some((row) => row.name === name);

    if (hasColumn("pos_category_id")) {
        console.log("= categories.pos_category_id ya existe, no se toca");
    } else {
        await client.execute("ALTER TABLE categories ADD COLUMN pos_category_id TEXT");
        console.log("✓ categories.pos_category_id agregada");
    }

    await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS categories_pos_category_id_idx ON categories(pos_category_id)"
    );
    console.log("✓ índice único categories_pos_category_id_idx");

    await client.execute("CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories(parent_id)");
    console.log("✓ índice categories_parent_id_idx");

    const resumen = await client.execute(`
        SELECT count(*) AS total,
               sum(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) AS con_padre,
               sum(CASE WHEN pos_category_id IS NOT NULL THEN 1 ELSE 0 END) AS con_id_pos
          FROM categories
    `);
    const { total, con_padre, con_id_pos } = resumen.rows[0];
    console.log(`\nCategorías: ${total} · con padre: ${con_padre} · con id de POSVECI: ${con_id_pos}`);
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}

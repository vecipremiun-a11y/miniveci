import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
  const rs = await client.execute("PRAGMA table_info(api_credentials)");
  console.log(rs.rows.map((r: any) => r.name));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

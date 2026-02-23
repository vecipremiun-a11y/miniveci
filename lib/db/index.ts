import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    throw new Error("Falta la variable de entorno TURSO_DATABASE_URL. Verifica tu archivo .env.local");
}

if (!authToken) {
    throw new Error("Falta la variable de entorno TURSO_AUTH_TOKEN. Verifica tu archivo .env.local");
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });

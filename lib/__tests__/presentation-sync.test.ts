/**
 * Sync de unidades de medida POSVECI → miniveci contra una base SQLite de
 * verdad (archivo temporal, con la migración 0029 tal cual).
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as schema from "../db/schema";
import { productPresentations } from "../db/schema";
import { readSyncPresentations, syncPosPresentations } from "../presentation-sync";

let client: Client;
let db: ReturnType<typeof drizzle<typeof schema>>;

// Una carpeta temporal por corrida. En Windows libsql puede dejar tomado el
// archivo hasta que termina el proceso: se borra al final y, si no se pudo, la
// próxima corrida limpia las carpetas viejas.
const TMP_PREFIX = "miniveci-presentations-";
for (const name of fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith(TMP_PREFIX))) {
    try { fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true }); } catch { /* sigue tomada */ }
}
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX));
let dbCount = 0;

const huevo = { id: "huevo", unit: "Und" };
const caja = { pos_presentation_id: "12", name: "Caja", units: 30, price: 7500, barcode: "656885587", is_active: true };
const bandeja = { pos_presentation_id: "15", name: "Bandeja", units: 15, price: 4500, barcode: null, is_active: true };

async function rows(productId = "huevo") {
    const list = await db.select().from(productPresentations).where(eq(productPresentations.productId, productId));
    return list.sort((a, b) => a.units - b.units);
}

async function addStoreRow(values: Partial<typeof productPresentations.$inferInsert> = {}) {
    await db.insert(productPresentations).values({
        id: "propia", productId: "huevo", source: "store", name: "Pack", units: 6, price: 1800, barcode: "PACK6",
        isActive: true, hiddenInStore: false, ...values,
    });
}

beforeEach(async () => {
    // Archivo y no ":memory:": las transacciones de libsql abren otra conexión.
    client = createClient({ url: `file:${path.join(tmpDir, `test-${++dbCount}.db`)}` });
    await client.execute("CREATE TABLE products (id TEXT PRIMARY KEY, sku TEXT, name TEXT, unit TEXT)");
    await client.execute("CREATE TABLE order_items (id TEXT PRIMARY KEY)");
    const migration = fs.readFileSync(path.join(process.cwd(), "drizzle/0029_product_presentations.sql"), "utf8");
    const statements = migration.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) await client.execute(statement);
    await client.execute("INSERT INTO products (id, sku, name, unit) VALUES ('huevo', 'H1', 'Huevo Extra', 'Und'), ('leche', 'L1', 'Leche', 'Und'), ('harina', 'K1', 'Harina', 'Kg')");
    db = drizzle(client, { schema });
});

afterEach(() => {
    client.close();
});

afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* la limpia la próxima corrida */ }
});

describe("readSyncPresentations: ausente = no tocar", () => {
    it("ausente o null no tocan nada; un array (aunque sea []) es la lista completa", () => {
        expect(readSyncPresentations(undefined)).toBeUndefined();
        expect(readSyncPresentations(null)).toBeUndefined();
        expect(readSyncPresentations([])).toEqual([]);
        expect(readSyncPresentations([caja])).toEqual([caja]);
    });
});

describe("syncPosPresentations", () => {
    it("lista: crea las del POS", async () => {
        const r = await syncPosPresentations(db, huevo, [caja, bandeja]);
        expect(r).toEqual({ upserted: 2, unchanged: 0, deleted: 0, skipped: [] });
        const saved = await rows();
        expect(saved.map((p) => [p.source, p.posPresentationId, p.name, p.units, p.price, p.barcode, p.isActive, p.hiddenInStore])).toEqual([
            ["pos", "15", "Bandeja", 15, 4500, null, true, false],
            ["pos", "12", "Caja", 30, 7500, "656885587", true, false],
        ]);
    });

    it("idempotente: mandar lo mismo dos veces no cambia nada", async () => {
        await syncPosPresentations(db, huevo, [caja, bandeja]);
        const before = await rows();
        const r = await syncPosPresentations(db, huevo, [caja, bandeja]);
        expect(r).toEqual({ upserted: 0, unchanged: 2, deleted: 0, skipped: [] });
        expect(await rows()).toEqual(before);
    });

    it("actualiza por pos_presentation_id sin tocar hidden_in_store", async () => {
        await syncPosPresentations(db, huevo, [caja]);
        const [first] = await rows();
        await db.update(productPresentations).set({ hiddenInStore: true }).where(eq(productPresentations.id, first.id));

        const r = await syncPosPresentations(db, huevo, [{ ...caja, price: 7800, is_active: false }]);
        expect(r.upserted).toBe(1);
        const [after] = await rows();
        expect(after.id).toBe(first.id);
        expect(after.price).toBe(7800);
        expect(after.isActive).toBe(false);
        expect(after.hiddenInStore).toBe(true);
    });

    it("las del POS que no vienen se borran", async () => {
        await syncPosPresentations(db, huevo, [caja, bandeja]);
        const r = await syncPosPresentations(db, huevo, [caja]);
        expect(r.deleted).toBe(1);
        expect((await rows()).map((p) => p.name)).toEqual(["Caja"]);
    });

    it("[] borra todas las del POS", async () => {
        await syncPosPresentations(db, huevo, [caja, bandeja]);
        const r = await syncPosPresentations(db, huevo, []);
        expect(r).toEqual({ upserted: 0, unchanged: 0, deleted: 2, skipped: [] });
        expect(await rows()).toEqual([]);
    });

    it("las propias de miniveci ('store') no se tocan nunca", async () => {
        await addStoreRow({ hiddenInStore: true });
        const [before] = await rows();
        await syncPosPresentations(db, huevo, [caja, bandeja]);
        await syncPosPresentations(db, huevo, []);
        expect(await rows()).toEqual([before]);
    });

    it("solo toca su producto", async () => {
        await syncPosPresentations(db, { id: "leche", unit: "Und" }, [{ ...caja, pos_presentation_id: "99", barcode: "LECHE12" }]);
        await syncPosPresentations(db, huevo, []);
        expect((await rows("leche")).length).toBe(1);
    });

    it("las inválidas se saltan, se informan y no hacen fallar el resto", async () => {
        await syncPosPresentations(db, huevo, [caja, bandeja]);
        const r = await syncPosPresentations(db, huevo, [
            caja,
            { ...bandeja, price: 4600 }, // no divide por 15
            { pos_presentation_id: "20", name: "Pack", units: 1, price: 300 },
        ]);
        expect(r.upserted).toBe(0);
        expect(r.unchanged).toBe(1);
        expect(r.skipped.map((s) => s.pos_presentation_id)).toEqual(["15", "20"]);
        // La versión vieja de la bandeja no se sigue vendiendo con datos que el POS ya cambió.
        expect(r.deleted).toBe(1);
        expect((await rows()).map((p) => p.name)).toEqual(["Caja"]);
    });

    it("en un producto por peso se saltan todas", async () => {
        const r = await syncPosPresentations(db, { id: "harina", unit: "Kg" }, [caja]);
        expect(r.upserted).toBe(0);
        expect(r.skipped).toHaveLength(1);
        expect(await rows("harina")).toEqual([]);
    });

    it("no repite un código de barras que ya usa otra presentación", async () => {
        await addStoreRow({ barcode: "656885587" });
        const r = await syncPosPresentations(db, huevo, [caja, bandeja]);
        expect(r.upserted).toBe(1);
        expect(r.skipped[0]).toMatchObject({ pos_presentation_id: "12" });
    });

    it("dos presentaciones pueden intercambiarse el código en un mismo envío", async () => {
        await syncPosPresentations(db, huevo, [caja, { ...bandeja, barcode: "B15" }]);
        const r = await syncPosPresentations(db, huevo, [{ ...caja, barcode: "B15" }, { ...bandeja, barcode: "656885587" }]);
        expect(r.upserted).toBe(2);
        expect((await rows()).map((p) => [p.name, p.barcode])).toEqual([["Bandeja", "656885587"], ["Caja", "B15"]]);
    });
});

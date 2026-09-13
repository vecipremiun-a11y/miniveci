import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { foldSearchText, matchesSearchTokens, tokenizeSearch } from "../search-text";
import { searchTokensCondition } from "../search-sql";

describe("tokenizeSearch", () => {
    it("normaliza mayúsculas, tildes y espacios", () => {
        expect(tokenizeSearch("  Detergente   MÁS ")).toEqual(["detergente", "mas"]);
        expect(foldSearchText("AJÍ Pingüino Ñandú")).toBe("aji pinguino ñandu");
    });

    it("descarta conectores salvo que sean lo único escrito", () => {
        expect(tokenizeSearch("jugo de naranja")).toEqual(["jugo", "naranja"]);
        expect(tokenizeSearch("de la")).toEqual(["de", "la"]);
    });

    it("separa por guiones y puntuación, sin repetir", () => {
        expect(tokenizeSearch("coca-cola, Coca")).toEqual(["coca", "cola"]);
        expect(tokenizeSearch("   ")).toEqual([]);
    });
});

describe("matchesSearchTokens", () => {
    it("encuentra las palabras en cualquier orden y en cualquier campo", () => {
        const fields = ["Mas Detergente Liquido Color 3Lt", null, "Limpieza"];
        expect(matchesSearchTokens(tokenizeSearch("detergente mas"), fields)).toBe(true);
        expect(matchesSearchTokens(tokenizeSearch("mas limpieza"), fields)).toBe(true);
        expect(matchesSearchTokens(tokenizeSearch("detergente polvo"), fields)).toBe(false);
        expect(matchesSearchTokens([], fields)).toBe(true);
    });
});

describe("searchTokensCondition (SQLite real)", () => {
    const items = sqliteTable("items", {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        description: text("description"),
    });
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client);

    const search = async (query: string) => {
        const rows = await db
            .select({ id: items.id })
            .from(items)
            .where(searchTokensCondition(tokenizeSearch(query), [items.name, items.description]))
            .orderBy(items.id);
        return rows.map((row) => row.id);
    };

    beforeAll(async () => {
        await client.execute("CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT)");
        const rows: Array<[string, string, string | null]> = [
            ["mas", "Mas Detergente Liquido Color 3Lt", null],
            ["bio", "Bio Detergente En Polvo Frescura 800g", "Rinde más lavados"],
            ["aji", "Aji Amarillo 1Und", null],
            ["aji-tilde", "Ají Amarillo Sin Picante 8g", null],
            ["angel", "Carozzi Cabello Ángel Corto 400g", null],
            ["pina", "Aconcagua Piña Rodajas 565g", null],
            ["pina-mayus", "PIÑA EN CONSERVA", null],
            ["espinaca", "Espinaca", null],
            ["jugo", "Jugo 100% Natural Naranja 1L", null],
            ["arroz", "Arroz Grado 1 1000g", null],
        ];
        for (const [id, name, description] of rows) {
            await client.execute({ sql: "INSERT INTO items VALUES (?, ?, ?)", args: [id, name, description] });
        }
    });

    it("no importa el orden de las palabras", async () => {
        expect(await search("mas detergente")).toEqual(["bio", "mas"]);
        expect(await search("liquido detergente")).toEqual(["mas"]);
        expect(await search("detergente polvo")).toEqual(["bio"]);
    });

    it("no importan las tildes en la búsqueda ni en el producto", async () => {
        expect(await search("ají amarillo")).toEqual(["aji", "aji-tilde"]);
        expect(await search("aji amarillo")).toEqual(["aji", "aji-tilde"]);
        expect(await search("angel cabello")).toEqual(["angel"]);
    });

    it("la ñ es su propia letra, también en mayúsculas", async () => {
        expect(await search("piña")).toEqual(["pina", "pina-mayus"]);
        expect(await search("PIÑA")).toEqual(["pina", "pina-mayus"]);
        expect(await search("pina")).toEqual(["espinaca"]);
    });

    it("trata % y _ como texto, no como comodines", async () => {
        expect(await search("100%")).toEqual(["jugo"]);
        expect(await search("1_00")).toEqual([]);
    });
});

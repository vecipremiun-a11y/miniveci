import { and, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { ACCENT_FOLDS } from "./search-text";

// lower() de SQLite solo convierte ASCII, así que las mayúsculas acentuadas y la Ñ
// se bajan a mano además de quitar las tildes.
const SQL_FOLDS: Array<readonly [string, string]> = [
    ...ACCENT_FOLDS.flatMap(([accented, plain]) => [[accented, plain], [accented.toUpperCase(), plain]] as const),
    ["Ñ", "ñ"],
];

// Equivalente SQL de foldSearchText: minúsculas y sin tildes.
function foldSql(expr: SQLWrapper): SQL {
    const literal = (value: string) => sql.raw(`'${value}'`);
    let folded: SQL = sql`lower(${expr})`;
    for (const [from, to] of SQL_FOLDS) {
        folded = sql`replace(${folded}, ${literal(from)}, ${literal(to)})`;
    }
    return folded;
}

function containsPattern(token: string): string {
    return `%${token.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

// Condición "cada palabra aparece en alguno de los campos", sin importar orden,
// mayúsculas ni tildes. Los tokens deben venir de tokenizeSearch (ya normalizados).
export function searchTokensCondition(tokens: string[], fields: SQLWrapper[]): SQL | undefined {
    if (tokens.length === 0 || fields.length === 0) return undefined;
    const haystack = foldSql(sql.join(fields.map((field) => sql`coalesce(${field}, '')`), sql` || ' ' || `));
    return and(...tokens.map((token) => sql`${haystack} LIKE ${containsPattern(token)} ESCAPE '\\'`));
}

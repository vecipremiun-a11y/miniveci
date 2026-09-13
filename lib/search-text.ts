// Normalización del buscador de productos. Sin dependencias de servidor para
// que la use tanto el SQL (lib/search-sql.ts) como el filtro en vivo del cliente.

// Tildes que se ignoran al buscar: "aji amarillo" encuentra "Ají Amarillo" y al revés.
// La tabla es explícita porque lower() de SQLite solo pasa a minúsculas el ASCII
// (lower('Á') = 'Á'), así que el SQL necesita reemplazar cada letra a mano.
// La ñ no se pliega: es otra letra y "piña" no debe traer "Espinaca".
export const ACCENT_FOLDS: ReadonlyArray<readonly [string, string]> = [
    ["á", "a"],
    ["é", "e"],
    ["í", "i"],
    ["ó", "o"],
    ["ú", "u"],
    ["ü", "u"],
];

const FOLD_MAP = new Map(ACCENT_FOLDS);
const FOLD_RE = new RegExp(`[${ACCENT_FOLDS.map(([accented]) => accented).join("")}]`, "g");

// Conectores que no ayudan a encontrar un producto: "jugo de naranja" debe
// encontrar "Jugo Naranja 1L" aunque el nombre no diga "de".
const STOPWORDS = new Set([
    "a", "al", "de", "del", "e", "el", "en", "la", "las", "lo", "los",
    "o", "para", "por", "u", "un", "una", "y",
]);

const MAX_TOKENS = 8;

export function foldSearchText(value: string): string {
    return value.normalize("NFC").toLowerCase().replace(FOLD_RE, (ch) => FOLD_MAP.get(ch) ?? ch);
}

// Separa la búsqueda en palabras sueltas: cada una debe aparecer en el producto,
// en cualquier orden ("detergente mas" encuentra "Mas Detergente Liquido").
export function tokenizeSearch(query: string): string[] {
    const words = foldSearchText(query).split(/[\s,;:()"'¿?¡!-]+/).filter(Boolean);
    const meaningful = words.filter((word) => !STOPWORDS.has(word));
    // Si solo escribieron conectores ("de la"), se buscan tal cual en vez de devolver todo.
    const tokens = meaningful.length > 0 ? meaningful : words;
    return Array.from(new Set(tokens)).slice(0, MAX_TOKENS);
}

export function matchesSearchTokens(tokens: string[], fields: Array<string | null | undefined>): boolean {
    if (tokens.length === 0) return true;
    const haystack = foldSearchText(fields.filter(Boolean).join(" "));
    return tokens.every((token) => haystack.includes(token));
}

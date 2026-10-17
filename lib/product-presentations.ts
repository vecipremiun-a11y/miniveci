/**
 * Unidades de medida (presentaciones): Caja de 30, Bandeja de 15, Pack de 6…
 * Copia la regla de POSVECI:
 *
 * - EL STOCK VIVE SIEMPRE EN UNIDADES. Una presentación solo dice cuántas
 *   unidades trae y a cuánto se vende entera: 2 cajas de 30 = 60 unidades menos.
 * - Solo productos por unidad (unit 'Und'). Los de peso no tienen, por ahora.
 * - `units` entero ≥ 2. `price` en pesos enteros, IVA incluido, y DIVISIBLE
 *   EXACTO por `units`: la venta y la boleta van en unidades (60 × $250) y la
 *   boleta redondea el precio unitario antes de multiplicar; si no divide
 *   exacto, la boleta no cuadra con lo cobrado.
 * - El precio de la presentación es FIJO: sin escala de precios, sin grupo de
 *   escala, sin oferta ni stock en oferta, y sin precio de socio.
 *
 * Módulo sin base ni React: lo usan el servidor (checkout, sync, admin) y el
 * carrito del front, y se testea solo (lib/__tests__/product-presentations.test.ts).
 */

export const MIN_PRESENTATION_UNITS = 2;
export const MAX_PRESENTATION_UNITS = 10000;
export const MAX_PRESENTATION_NAME = 40;
export const MAX_PRESENTATION_BARCODE = 64;

export type PresentationSource = "pos" | "store";

/** Lo que ven la tienda web y la app de una presentación (solo las visibles). */
export interface StorePresentation {
    id: string;
    name: string;
    units: number;
    price: number;
}

/** Una fila de product_presentations, con lo que hace falta para venderla. */
export interface PresentationRecord {
    id: string;
    productId: string;
    source: string;
    posPresentationId: string | null;
    name: string;
    units: number;
    price: number;
    barcode: string | null;
    isActive: boolean;
    hiddenInStore: boolean;
}

/** Solo productos por unidad. Los de peso (y los de unidad equivalente) no. */
export function presentationsAllowed(product: {
    unit?: string | null;
    equivLabel?: string | null;
    equivWeight?: number | null;
}): boolean {
    const unit = (product.unit ?? "Und").trim().toLowerCase();
    if (unit !== "und" && unit !== "un" && unit !== "unidad") return false;
    return !(product.equivLabel && product.equivWeight && product.equivWeight > 0);
}

/** Se vende en la tienda: activa (la decide su dueño) y no oculta en la web. */
export function isPresentationVisible(p: { isActive?: boolean | null; hiddenInStore?: boolean | null }): boolean {
    return Boolean(p.isActive) && !p.hiddenInStore;
}

export function toStorePresentation(p: Pick<PresentationRecord, "id" | "name" | "units" | "price">): StorePresentation {
    return { id: p.id, name: p.name, units: p.units, price: p.price };
}

/** Orden de muestra: de la más chica a la más grande. */
export function sortPresentations<T extends { units: number; name: string }>(list: T[]): T[] {
    return [...list].sort((a, b) => a.units - b.units || a.name.localeCompare(b.name, "es"));
}

// --- Formato ---

const clpNumber = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

function clp(value: number): string {
    return `$${clpNumber.format(value)}`;
}

/** "Caja (30 und)" */
export function presentationLabel(name: string, units: number): string {
    return `${name} (${units} und)`;
}

/** "2 Caja (30 und)" */
export function formatPresentationQty(qty: number, name: string, units: number): string {
    return `${qty} ${presentationLabel(name, units)}`;
}

/** "2 Caja (30 und) × $7.500": como sale en el ticket del POS. */
export function formatPresentationLine(p: { qty: number; name: string; units: number; price: number }): string {
    return `${formatPresentationQty(p.qty, p.name, p.units)} × ${clp(p.price)}`;
}

/** Cuántas presentaciones enteras se arman con el stock ("26 armadas"). */
export function assembledCount(stock: number | null | undefined, units: number): number {
    if (!stock || stock <= 0 || units <= 0) return 0;
    return Math.floor(stock / units);
}

// --- Validación (admin y sync) ---

/**
 * Los dos precios más cercanos que sí se dividen exacto por las unidades:
 * floor(price/units)*units y ceil(price/units)*units (sin repetir ni ceros).
 */
export function presentationPriceSuggestions(price: number, units: number): number[] {
    if (!(units > 0) || !(price > 0)) return [];
    const down = Math.floor(price / units) * units;
    const up = Math.ceil(price / units) * units;
    return [...new Set([down, up])].filter((v) => v > 0);
}

export interface PresentationFields {
    name: string;
    units: number;
    price: number;
    barcode: string | null;
}

export type PresentationValidation =
    | { ok: true; value: PresentationFields }
    | { ok: false; field: keyof PresentationFields; error: string; suggestions?: number[] };

function toNumber(value: unknown): number {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") return Number(value.trim());
    return NaN;
}

/**
 * Valida nombre, unidades, precio y código de una presentación. Es la misma
 * regla en el formulario del admin, en su API y en el sync de POSVECI.
 */
export function validatePresentation(input: {
    name?: unknown;
    units?: unknown;
    price?: unknown;
    barcode?: unknown;
}): PresentationValidation {
    const name = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim() : "";
    if (!name) return { ok: false, field: "name", error: "Ponle un nombre (ej: Caja, Bandeja, Pack)" };
    if (name.length > MAX_PRESENTATION_NAME) {
        return { ok: false, field: "name", error: `El nombre puede tener hasta ${MAX_PRESENTATION_NAME} letras` };
    }

    const units = toNumber(input.units);
    if (!Number.isInteger(units) || units < MIN_PRESENTATION_UNITS) {
        return { ok: false, field: "units", error: `Las unidades tienen que ser un número entero de ${MIN_PRESENTATION_UNITS} o más` };
    }
    if (units > MAX_PRESENTATION_UNITS) {
        return { ok: false, field: "units", error: `Máximo ${clpNumber.format(MAX_PRESENTATION_UNITS)} unidades por presentación` };
    }

    const price = toNumber(input.price);
    if (!Number.isFinite(price) || price <= 0) {
        return { ok: false, field: "price", error: "El precio tiene que ser mayor a $0" };
    }
    if (!Number.isInteger(price)) {
        return { ok: false, field: "price", error: "El precio va en pesos enteros, sin decimales" };
    }
    if (price % units !== 0) {
        const suggestions = presentationPriceSuggestions(price, units);
        const perUnit = (price / units).toLocaleString("es-CL", { maximumFractionDigits: 2 });
        return {
            ok: false,
            field: "price",
            error: `${clp(price)} no se divide exacto en ${units} unidades ($${perUnit} c/u) y la boleta no cuadraría. `
                + `Usa ${suggestions.map(clp).join(" o ")}.`,
            suggestions,
        };
    }

    let barcode: string | null = null;
    if (input.barcode !== null && input.barcode !== undefined) {
        if (typeof input.barcode !== "string" && typeof input.barcode !== "number") {
            return { ok: false, field: "barcode", error: "Código de barras inválido" };
        }
        const clean = String(input.barcode).trim();
        if (clean) {
            if (/\s/.test(clean)) return { ok: false, field: "barcode", error: "El código de barras no lleva espacios" };
            if (clean.length > MAX_PRESENTATION_BARCODE) {
                return { ok: false, field: "barcode", error: `El código puede tener hasta ${MAX_PRESENTATION_BARCODE} caracteres` };
            }
            barcode = clean;
        }
    }

    return { ok: true, value: { name, units, price, barcode } };
}

// --- Sync de POSVECI ---

export interface PosPresentationInput extends PresentationFields {
    posPresentationId: string;
    isActive: boolean;
}

export interface SkippedPresentation {
    pos_presentation_id: string | null;
    error: string;
}

function readPosId(item: Record<string, unknown>): string | null {
    const raw = item.pos_presentation_id ?? item.posPresentationId;
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "string" && typeof raw !== "number") return null;
    return String(raw).trim() || null;
}

function readActive(item: Record<string, unknown>): boolean | null {
    const raw = item.is_active !== undefined ? item.is_active : item.isActive;
    if (raw === undefined || raw === null) return true;
    if (typeof raw === "boolean") return raw;
    if (raw === 1 || raw === 0) return raw === 1;
    return null;
}

/**
 * Lee la lista de presentaciones que manda POSVECI (snake_case o camelCase).
 * Cada una se valida sola: la que no cumple se salta y se informa, sin hacer
 * fallar el sync del producto.
 */
export function parsePosPresentations(raw: unknown[]): { valid: PosPresentationInput[]; skipped: SkippedPresentation[] } {
    const valid: PosPresentationInput[] = [];
    const skipped: SkippedPresentation[] = [];
    const seenIds = new Set<string>();
    const seenBarcodes = new Set<string>();

    for (const entry of raw) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            skipped.push({ pos_presentation_id: null, error: "Cada presentación tiene que ser un objeto" });
            continue;
        }
        const item = entry as Record<string, unknown>;
        const posId = readPosId(item);
        if (!posId) {
            skipped.push({ pos_presentation_id: null, error: "Falta pos_presentation_id" });
            continue;
        }
        if (seenIds.has(posId)) {
            skipped.push({ pos_presentation_id: posId, error: "pos_presentation_id repetido en el envío" });
            continue;
        }
        seenIds.add(posId);

        const isActive = readActive(item);
        if (isActive === null) {
            skipped.push({ pos_presentation_id: posId, error: "is_active tiene que ser true o false" });
            continue;
        }

        const check = validatePresentation(item);
        if (!check.ok) {
            skipped.push({ pos_presentation_id: posId, error: check.error });
            continue;
        }
        if (check.value.barcode) {
            if (seenBarcodes.has(check.value.barcode)) {
                skipped.push({ pos_presentation_id: posId, error: `Código ${check.value.barcode} repetido en el envío` });
                continue;
            }
            seenBarcodes.add(check.value.barcode);
        }

        valid.push({ posPresentationId: posId, isActive, ...check.value });
    }

    return { valid, skipped };
}

// --- Renglones del pedido (servidor) ---

/** Foto de la presentación en un renglón de pedido. `qty` = cuántas presentaciones. */
export interface OrderLinePresentation {
    id: string;
    posPresentationId: string | null;
    name: string;
    units: number;
    qty: number;
    price: number;
}

export type PresentationLineResult =
    | { ok: true; presentation: OrderLinePresentation; quantity: number; unitPrice: number; totalPrice: number }
    | { ok: false; error: string };

/**
 * Renglón por presentación. El servidor NUNCA usa el precio del cliente: la
 * presentación tiene que ser de ese producto, estar activa y visible, y el
 * producto venderse por unidad. La cantidad del renglón queda en UNIDADES
 * (cajas × units) y el precio unitario = price / units, así stock, totales,
 * reportes y POSVECI siguen trabajando en unidades.
 *
 * El stock se revisa aparte, sumando todos los renglones del producto
 * (`presentationStockError`).
 */
export function resolvePresentationLine(
    product: { id: string; name: string; unit?: string | null; equivLabel?: string | null; equivWeight?: number | null },
    presentation: PresentationRecord | undefined,
    boxes: number,
): PresentationLineResult {
    const unavailable = `${product.name}: esa presentación ya no está disponible`;
    if (!presentation || presentation.productId !== product.id) return { ok: false, error: unavailable };
    if (!isPresentationVisible(presentation) || !presentationsAllowed(product)) return { ok: false, error: unavailable };
    if (presentation.units < MIN_PRESENTATION_UNITS || presentation.price <= 0 || presentation.price % presentation.units !== 0) {
        return { ok: false, error: unavailable };
    }
    if (!Number.isInteger(boxes) || boxes < 1) return { ok: false, error: `${product.name}: cantidad inválida` };

    return {
        ok: true,
        presentation: {
            id: presentation.id,
            posPresentationId: presentation.source === "pos" ? presentation.posPresentationId : null,
            name: presentation.name,
            units: presentation.units,
            qty: boxes,
            price: presentation.price,
        },
        quantity: boxes * presentation.units,
        unitPrice: presentation.price / presentation.units,
        totalPrice: boxes * presentation.price,
    };
}

/**
 * Stock en unidades contra TODOS los renglones del producto en el pedido
 * (sueltas + cajas × units). Solo se revisa en los productos que llevan al
 * menos un renglón por presentación; los pedidos solo por unidad siguen como
 * siempre. El stock que se compara ya viene descontado de los pedidos web que
 * POSVECI aún no recibió (adjustPosStockForPendingWebOrders).
 */
export function presentationStockError(
    lines: { productId: string; units: number; byPresentation: boolean }[],
    stockOf: Map<string, { name: string; stock: number }>,
): string | null {
    const withPresentation = new Set(lines.filter((l) => l.byPresentation).map((l) => l.productId));
    const totals = new Map<string, number>();
    for (const line of lines) {
        if (!withPresentation.has(line.productId)) continue;
        totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.units);
    }
    for (const [productId, total] of totals) {
        const product = stockOf.get(productId);
        if (!product) continue;
        const stock = Math.max(0, Math.floor(product.stock));
        if (total > stock) {
            return stock > 0
                ? `${product.name}: no alcanza el stock (quedan ${stock} unidades y el pedido lleva ${total})`
                : `${product.name}: sin stock`;
        }
    }
    return null;
}

/** Columnas de order_items del renglón (todas NULL si se vendió por unidad). */
export function orderItemPresentationColumns(p: OrderLinePresentation | null | undefined) {
    return {
        presentationId: p?.id ?? null,
        presentationPosId: p?.posPresentationId ?? null,
        presentationName: p?.name ?? null,
        presentationUnits: p?.units ?? null,
        presentationQty: p?.qty ?? null,
        presentationPrice: p?.price ?? null,
    };
}

/** Lee la foto de presentación de un order_item, o null si fue por unidad. */
export function orderItemPresentation(row: {
    presentationId?: string | null;
    presentationPosId?: string | null;
    presentationName?: string | null;
    presentationUnits?: number | null;
    presentationQty?: number | null;
    presentationPrice?: number | null;
}): OrderLinePresentation | null {
    if (!row.presentationName || !row.presentationUnits || !row.presentationQty || row.presentationPrice == null) return null;
    return {
        id: row.presentationId ?? "",
        posPresentationId: row.presentationPosId ?? null,
        name: row.presentationName,
        units: row.presentationUnits,
        qty: row.presentationQty,
        price: row.presentationPrice,
    };
}

// --- Carrito (front) ---

const PRESENTATION_LINE_MARK = "__p:";

/**
 * Id del renglón del carrito. Un producto puede ir en varios renglones: por
 * unidad (id del producto) y uno por cada presentación, así se puede llevar
 * 1 caja y 3 unidades sueltas por separado.
 */
export function presentationCartId(productId: string, presentationId: string): string {
    return `${productId}${PRESENTATION_LINE_MARK}${presentationId}`;
}

/** Id real del producto de un renglón del carrito (sin `__kg` ni presentación). */
export function cartLineProductId(lineId: string): string {
    const mark = lineId.indexOf(PRESENTATION_LINE_MARK);
    const base = mark >= 0 ? lineId.slice(0, mark) : lineId;
    return base.replace(/__kg$/, "");
}

/**
 * Cuántas presentaciones caben: el stock que dejan los otros renglones del
 * mismo producto, dividido por las unidades de la presentación.
 */
export function maxPresentationBoxes(stock: number | null | undefined, units: number, unitsInOtherLines = 0): number {
    if (stock === null || stock === undefined || units <= 0) return 0;
    return Math.max(0, Math.floor((stock - unitsInOtherLines) / units));
}

/**
 * Comprobante de transferencia de un pedido web.
 *
 * El checkout lo sube por /api/store/upload-receipt (Vercel Blob, carpeta
 * `receipts/`) y la URL queda en `orders.paymentId`. Esa URL viaja a POSVECI
 * como `payment_proof_url` y el cajero la abre con "Ver comprobante", así que
 * solo se acepta una URL de nuestro almacenamiento: el pedido web se arma en el
 * navegador y podría traer cualquier enlace (por ejemplo, una página de phishing
 * para el local).
 */
export function isReceiptUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:"
            && url.hostname.endsWith(".public.blob.vercel-storage.com")
            && url.pathname.startsWith("/receipts/");
    } catch {
        return false;
    }
}

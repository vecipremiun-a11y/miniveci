/**
 * RUT chileno: formato y dígito verificador (módulo 11).
 * Sin dependencias de servidor: lo usan el checkout (navegador) y la API.
 */

/** Solo dígitos y K mayúscula: "12.345.678-k" → "12345678K". */
function cleanRut(raw: string): string {
    return raw.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Formato con puntos y guion: "123456785" → "12.345.678-5". */
export function formatRut(raw: string): string {
    const clean = cleanRut(raw).slice(0, 9);
    if (clean.length <= 1) return clean;
    const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${body}-${clean.slice(-1)}`;
}

/** ¿El dígito verificador calza con el número? */
export function isValidRut(raw: string): boolean {
    const clean = cleanRut(raw);
    if (!/^\d{7,8}[\dK]$/.test(clean)) return false;
    const body = clean.slice(0, -1);
    let sum = 0;
    let factor = 2;
    for (let i = body.length - 1; i >= 0; i--) {
        sum += Number(body[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const rest = 11 - (sum % 11);
    const dv = rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
    return clean.slice(-1) === dv;
}

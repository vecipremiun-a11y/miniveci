// Utilidades de zona horaria de Chile (America/Santiago).
// POSVECI envía fechas en hora local Chile sin offset (ej. "2026-06-21T18:30").
// El servidor (Vercel) corre en UTC, así que hay que convertir explícitamente.

const CHILE_TZ = "America/Santiago";

/** Offset de America/Santiago (en ms) para un instante dado. Maneja el horario de verano. */
function chileOffsetMs(instant: Date): number {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: CHILE_TZ,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const p = dtf.formatToParts(instant).reduce<Record<string, string>>((acc, part) => {
        if (part.type !== "literal") acc[part.type] = part.value;
        return acc;
    }, {});
    const asUtc = Date.UTC(
        Number(p.year),
        Number(p.month) - 1,
        Number(p.day),
        Number(p.hour),
        Number(p.minute),
        Number(p.second),
    );
    return asUtc - instant.getTime();
}

/**
 * Convierte una hora de pared en Chile (ej. "2026-06-21T18:30" o "2026-06-21T18:30:00")
 * a un ISO string en UTC. Devuelve null si la entrada es inválida/vacía.
 */
export function chileLocalToUtcISO(local: string | null | undefined): string | null {
    if (!local) return null;
    const trimmed = local.trim();
    // Normaliza a "YYYY-MM-DDTHH:mm:ss" y lo trata primero como si fuese UTC.
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const [, y, mo, d, hh, mm, ss] = m;
    const pretendUtc = Date.UTC(
        Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? "0"),
    );
    // El offset calculado sobre el instante pretendido es exacto salvo en el salto de DST.
    const offset = chileOffsetMs(new Date(pretendUtc));
    return new Date(pretendUtc - offset).toISOString();
}

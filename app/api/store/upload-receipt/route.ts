import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getBakeryUser } from "@/lib/bakery-auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Subida del comprobante de transferencia.
 *
 * El checkout admite invitados (pedido sin cuenta), así que este endpoint NO
 * puede exigir sesión. Lo que sí se cierra:
 *
 *  1. La extensión se deriva del MIME de la lista blanca, NUNCA de `file.name`.
 *     `file.type` y `file.name` los controla el cliente; aceptar la extensión del
 *     nombre permitía guardar un `.html` público en nuestro dominio de blobs
 *     (página de phishing servida desde miniveci). Mismo criterio que
 *     `lib/chat-attachments.ts`.
 *  2. Se verifican los magic bytes: un `Content-Type: image/png` falso no puede
 *     colar contenido de otro tipo.
 *  3. Límite de tasa por IP para acotar el abuso de almacenamiento.
 *  4. Si hay sesión, el archivo se guarda bajo el id del usuario (trazabilidad).
 */

type AllowedKind = { extension: string; contentType: string };

const ALLOWED_TYPES: Record<string, AllowedKind> = {
    "image/jpeg": { extension: "jpg", contentType: "image/jpeg" },
    "image/jpg": { extension: "jpg", contentType: "image/jpeg" },
    "image/png": { extension: "png", contentType: "image/png" },
    "image/webp": { extension: "webp", contentType: "image/webp" },
    "application/pdf": { extension: "pdf", contentType: "application/pdf" },
};

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/** Comprueba que los primeros bytes correspondan al tipo declarado. */
function magicBytesMatch(extension: string, bytes: Buffer): boolean {
    const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);

    switch (extension) {
        case "jpg":
            // FF D8 FF
            return startsWith(0xff, 0xd8, 0xff);
        case "png":
            // 89 50 4E 47 0D 0A 1A 0A
            return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
        case "webp":
            // "RIFF" .... "WEBP"
            return (
                startsWith(0x52, 0x49, 0x46, 0x46) &&
                bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
            );
        case "pdf":
            // "%PDF-"
            return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
        default:
            return false;
    }
}

export async function POST(request: NextRequest) {
    const limited = enforceRateLimit(request, RATE_LIMITS.upload);
    if (limited) return limited;

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
        }

        const kind = ALLOWED_TYPES[(file.type || "").toLowerCase()];
        if (!kind) {
            return NextResponse.json(
                { error: "Formato no válido. Sube una imagen (JPG, PNG, WebP) o PDF." },
                { status: 400 }
            );
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json(
                { error: "El archivo es muy grande. Máximo 5MB." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        if (!magicBytesMatch(kind.extension, buffer)) {
            return NextResponse.json(
                { error: "El archivo no coincide con el formato declarado." },
                { status: 400 }
            );
        }

        // Si hay sesión, agrupar por usuario; si es invitado, carpeta común.
        const user = await getBakeryUser(request);
        const scope = user ? user.id : "guest";

        // Nombre construido íntegramente en el servidor: nada que venga del cliente.
        const filename = `receipts/${scope}/${randomUUID()}.${kind.extension}`;

        const blob = await put(filename, buffer, {
            access: "public",
            addRandomSuffix: true,
            contentType: kind.contentType,
        });

        return NextResponse.json({ url: blob.url });
    } catch (error) {
        console.error("[UPLOAD_RECEIPT]", error);
        return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 500 });
    }
}

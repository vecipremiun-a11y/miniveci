import { put } from "@vercel/blob";
import type { ChatMessageType } from "./chat-live-updates";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

const IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/gif",
]);

const FILE_MIME_TYPES = new Set([
    "application/pdf",
]);

export interface AttachmentValidation {
    messageType: ChatMessageType;
    extension: string;
}

/**
 * Valida el MIME y devuelve el tipo de mensaje y extensión inferida.
 * Lanza si no es soportado.
 */
export function validateChatAttachment(file: File): AttachmentValidation {
    if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new Error("El archivo supera el límite de 5MB.");
    }

    const mime = (file.type || "").toLowerCase();

    if (IMAGE_MIME_TYPES.has(mime)) {
        const ext = mime.split("/")[1] || "jpg";
        return { messageType: "image", extension: ext.replace("jpeg", "jpg") };
    }
    if (FILE_MIME_TYPES.has(mime)) {
        return { messageType: "file", extension: "pdf" };
    }

    throw new Error("Formato no permitido. Sube imagen (JPG, PNG, WebP, HEIC, GIF) o PDF.");
}

/**
 * Sube el archivo a Vercel Blob bajo `chat/<conversationId>/<id>.<ext>`.
 */
export async function uploadChatAttachment(opts: {
    conversationId: string;
    file: File;
    validation: AttachmentValidation;
}) {
    const { conversationId, file, validation } = opts;
    const id = crypto.randomUUID();
    const key = `chat/${conversationId}/${id}.${validation.extension}`;
    const blob = await put(key, file, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type || undefined,
    });
    return { url: blob.url, key };
}

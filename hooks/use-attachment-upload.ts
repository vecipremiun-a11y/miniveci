'use client';

import { useCallback, useRef, useState } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set<string>([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    'application/pdf',
]);

export interface UploadedMessage {
    id: string;
    conversationId: string;
    senderType: 'customer' | 'agent' | 'system';
    senderId: string | null;
    senderName: string | null;
    body: string;
    messageType: 'text' | 'image' | 'audio' | 'file';
    attachmentUrl: string | null;
    attachmentName: string | null;
    attachmentSize: number | null;
    mimeType: string | null;
    createdAt: string;
}

export function validateChatFile(file: File): { ok: true } | { ok: false; error: string } {
    if (file.size > MAX_BYTES) {
        return { ok: false, error: 'El archivo supera los 5 MB.' };
    }
    if (!ALLOWED_TYPES.has((file.type || '').toLowerCase())) {
        return { ok: false, error: 'Formato no permitido (JPG, PNG, WebP, HEIC, GIF o PDF).' };
    }
    return { ok: true };
}

/**
 * Hook que sube un archivo multipart/form-data con barra de progreso real (XHR).
 * - `upload({ url, file, extra })` → Promise<UploadedMessage>
 * - `progress` es 0..100
 * - `cancel()` aborta la subida en curso
 */
export function useAttachmentUpload() {
    const [progress, setProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const xhrRef = useRef<XMLHttpRequest | null>(null);

    const cancel = useCallback(() => {
        xhrRef.current?.abort();
        xhrRef.current = null;
        setUploading(false);
        setProgress(0);
    }, []);

    const upload = useCallback((opts: { url: string; file: File; extra?: Record<string, string> }) => {
        return new Promise<UploadedMessage>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhrRef.current = xhr;
            setUploading(true);
            setProgress(0);

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    setProgress(Math.round((e.loaded / e.total) * 100));
                }
            });

            xhr.addEventListener('load', () => {
                setUploading(false);
                xhrRef.current = null;
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(data as UploadedMessage);
                    } else {
                        reject(new Error(data?.error || 'Error subiendo archivo'));
                    }
                } catch {
                    reject(new Error('Respuesta inválida'));
                }
            });

            xhr.addEventListener('error', () => {
                setUploading(false);
                xhrRef.current = null;
                reject(new Error('Error de red'));
            });

            xhr.addEventListener('abort', () => {
                setUploading(false);
                xhrRef.current = null;
                reject(new Error('Subida cancelada'));
            });

            const fd = new FormData();
            fd.append('file', opts.file);
            if (opts.extra) {
                for (const [k, v] of Object.entries(opts.extra)) fd.append(k, v);
            }

            xhr.open('POST', opts.url);
            xhr.send(fd);
        });
    }, []);

    return { upload, cancel, progress, uploading };
}

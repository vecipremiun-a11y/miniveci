'use client';

import { useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface ChatLightboxProps {
    src: string;
    alt?: string;
    onClose: () => void;
}

export function ChatLightbox({ src, alt, onClose }: ChatLightboxProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                <a
                    href={src}
                    download
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
                    aria-label="Descargar"
                >
                    <Download className="w-5 h-5" />
                </a>
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
                    aria-label="Cerrar"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            <img
                src={src}
                alt={alt || ''}
                className="max-w-full max-h-full object-contain rounded-lg select-none"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

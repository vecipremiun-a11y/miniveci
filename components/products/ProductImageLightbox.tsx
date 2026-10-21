'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

interface ProductImageLightboxProps {
    images: { url: string; alt: string }[];
    index: number;
    onIndexChange: (index: number) => void;
    onClose: () => void;
}

const roundButton = 'w-11 h-11 flex items-center justify-center rounded-full bg-black/55 hover:bg-black/75 ring-1 ring-white/25 backdrop-blur text-white transition-colors';

// Visor a pantalla completa de las fotos del producto. Abre la foto ajustada a la
// pantalla; si la foto es más grande que la pantalla, un clic la muestra en su
// tamaño original (con scroll), centrada en el punto donde se hizo clic.
export function ProductImageLightbox({ images, index, onIndexChange, onClose }: ProductImageLightboxProps) {
    const [original, setOriginal] = useState(false);
    const [canZoom, setCanZoom] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    // Punto (en fracción de la foto) donde se hizo clic para ampliar.
    const zoomFocus = useRef({ x: 0.5, y: 0.5 });

    const count = images.length;
    const image = images[index] ?? images[0];

    const go = useCallback((delta: number) => {
        if (count < 2) return;
        onIndexChange((index + delta + count) % count);
    }, [count, index, onIndexChange]);

    // Solo vale la pena el tamaño original si la pantalla la está achicando.
    const measure = useCallback(() => {
        const img = imgRef.current;
        if (!img || !img.complete || img.naturalWidth === 0) return;
        setCanZoom(img.naturalWidth > img.clientWidth + 1 || img.naturalHeight > img.clientHeight + 1);
    }, []);

    // Al cambiar de foto vuelve a "ajustada".
    const [shownUrl, setShownUrl] = useState(image?.url);
    if (image?.url !== shownUrl) {
        setShownUrl(image?.url);
        setOriginal(false);
        setCanZoom(false);
    }

    // La primera medida la da onLoad de la foto (también al cambiar de foto).
    useEffect(() => {
        if (original) return;
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [original, measure]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === 'ArrowRight') go(1);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, go]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useLayoutEffect(() => {
        const box = scrollRef.current;
        const img = imgRef.current;
        if (!box || !img) return;
        if (original) {
            box.scrollLeft = img.offsetLeft + zoomFocus.current.x * img.naturalWidth - box.clientWidth / 2;
            box.scrollTop = img.offsetTop + zoomFocus.current.y * img.naturalHeight - box.clientHeight / 2;
        } else {
            box.scrollLeft = 0;
            box.scrollTop = 0;
        }
    }, [original]);

    const toggleOriginal = (e?: MouseEvent<HTMLImageElement>) => {
        if (!canZoom) return;
        if (!original) {
            const img = imgRef.current;
            zoomFocus.current = e && img
                ? { x: e.nativeEvent.offsetX / img.clientWidth, y: e.nativeEvent.offsetY / img.clientHeight }
                : { x: 0.5, y: 0.5 };
        }
        setOriginal((o) => !o);
    };

    if (!image) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-label={image.alt}
        >
            <div ref={scrollRef} className="absolute inset-0 flex overflow-auto p-4 sm:p-12" onClick={onClose}>
                <img
                    ref={imgRef}
                    src={image.url}
                    alt={image.alt}
                    onLoad={() => {
                        if (!original) measure();
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleOriginal(e);
                    }}
                    className={`m-auto shrink-0 select-none ${
                        original
                            ? 'max-w-none cursor-zoom-out'
                            : `max-w-full max-h-full object-contain ${canZoom ? 'cursor-zoom-in' : ''}`
                    }`}
                />
            </div>

            {count > 1 && (
                <span className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/55 ring-1 ring-white/25 backdrop-blur text-sm font-bold text-white tabular-nums">
                    {index + 1} / {count}
                </span>
            )}

            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                {canZoom && (
                    <button
                        type="button"
                        onClick={() => toggleOriginal()}
                        className={roundButton}
                        aria-label={original ? 'Ajustar a la pantalla' : 'Ver en tamaño original'}
                        title={original ? 'Ajustar a la pantalla' : 'Ver en tamaño original'}
                    >
                        {original ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
                    </button>
                )}
                <button type="button" onClick={onClose} className={roundButton} aria-label="Cerrar" title="Cerrar">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {count > 1 && (
                <>
                    <button
                        type="button"
                        onClick={() => go(-1)}
                        className={`${roundButton} absolute left-3 top-1/2 -translate-y-1/2 z-10`}
                        aria-label="Foto anterior"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        type="button"
                        onClick={() => go(1)}
                        className={`${roundButton} absolute right-3 top-1/2 -translate-y-1/2 z-10`}
                        aria-label="Foto siguiente"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </>
            )}

            {canZoom && !original && (
                <p className="absolute bottom-4 inset-x-0 z-10 text-center text-xs sm:text-sm font-semibold text-white/70 pointer-events-none">
                    Toca la imagen para verla en su tamaño original
                </p>
            )}
        </div>,
        document.body,
    );
}

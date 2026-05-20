'use client';

import { Download, FileText, ImageIcon, Loader2 } from 'lucide-react';

export type ChatAttachmentVariant = 'sender' | 'receiver';

interface ChatAttachmentProps {
    messageType: 'image' | 'audio' | 'file' | 'text';
    url: string | null;
    name?: string | null;
    size?: number | null;
    mimeType?: string | null;
    variant: ChatAttachmentVariant;
    pending?: boolean;
    progress?: number;
    onOpenImage?: (url: string) => void;
}

function formatSize(bytes: number | null | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ChatAttachment({
    messageType,
    url,
    name,
    size,
    variant,
    pending,
    progress,
    onOpenImage,
}: ChatAttachmentProps) {
    if (messageType === 'image') {
        return (
            <div className="relative">
                {url ? (
                    <button
                        type="button"
                        onClick={() => onOpenImage?.(url)}
                        className="block max-w-[260px] rounded-xl overflow-hidden border border-white/30 bg-slate-200/40 focus:outline-none focus:ring-2 focus:ring-veci-primary/60"
                    >
                        <img
                            src={url}
                            alt={name || 'imagen'}
                            className={`block w-full max-h-[280px] object-cover ${pending ? 'opacity-70' : ''}`}
                        />
                    </button>
                ) : (
                    <div className="w-[200px] h-[140px] rounded-xl bg-slate-200/60 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-slate-400" />
                    </div>
                )}
                {pending && (
                    <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/30">
                        <div className="flex flex-col items-center gap-1">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                            {typeof progress === 'number' && (
                                <span className="text-[10px] font-bold text-white tabular-nums">
                                    {progress}%
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (messageType === 'file') {
        const isSender = variant === 'sender';
        return (
            <a
                href={url || '#'}
                target="_blank"
                rel="noreferrer"
                download={name || true}
                onClick={(e) => { if (!url) e.preventDefault(); }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl max-w-[260px] transition-colors ${isSender
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    } ${pending ? 'opacity-70' : ''}`}
            >
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isSender ? 'bg-white/25' : 'bg-veci-primary/10'
                    }`}>
                    {pending
                        ? <Loader2 className={`w-4 h-4 animate-spin ${isSender ? 'text-white' : 'text-veci-primary'}`} />
                        : <FileText className={`w-4 h-4 ${isSender ? 'text-white' : 'text-veci-primary'}`} />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isSender ? 'text-white' : 'text-slate-800'}`}>
                        {name || 'Archivo'}
                    </p>
                    <p className={`text-[10px] ${isSender ? 'text-white/70' : 'text-slate-500'}`}>
                        {pending && typeof progress === 'number' ? `Subiendo ${progress}%` : formatSize(size)}
                    </p>
                </div>
                {!pending && url && (
                    <Download className={`w-4 h-4 shrink-0 ${isSender ? 'text-white/80' : 'text-slate-400'}`} />
                )}
            </a>
        );
    }

    return null;
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MessageCircle, X, Send, Loader2, CheckCheck, Paperclip } from 'lucide-react';
import { useChatSSE, type ChatSSEEvent } from '@/hooks/use-chat-sse';
import { useAttachmentUpload, validateChatFile } from '@/hooks/use-attachment-upload';
import { ChatAttachment } from './ChatAttachment';
import { ChatLightbox } from './ChatLightbox';

type ChatMsgType = 'text' | 'image' | 'audio' | 'file';

interface ChatMessage {
    id: string;
    conversationId?: string;
    senderType: 'customer' | 'agent' | 'system';
    senderName: string | null;
    body: string;
    messageType: ChatMsgType;
    attachmentUrl: string | null;
    attachmentName: string | null;
    attachmentSize: number | null;
    mimeType: string | null;
    createdAt: string;
    /** tempId local antes de confirmación servidor */
    tempId?: string;
    /** id pendiente, mostrarse como "enviando" */
    pending?: boolean;
    /** preview blob: para imágenes optimistas */
    localPreviewUrl?: string;
    /** progreso de subida 0..100 */
    uploadProgress?: number;
}

const GUEST_ID_KEY = 'miniveci_chat_guest_id';
const OPEN_KEY = 'miniveci_chat_open';

function getGuestId(): string {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
}

function formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

export function ChatWidget() {
    const { data: session, status: authStatus } = useSession();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [conversationStatus, setConversationStatus] = useState<'open' | 'closed'>('open');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [needsName, setNeedsName] = useState(false);
    const [unread, setUnread] = useState(0);
    const [hasMounted, setHasMounted] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const guestIdRef = useRef<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const initRef = useRef(false);
    const { upload, progress: uploadProgress, uploading } = useAttachmentUpload();
    // Refs estables para usar dentro del callback SSE sin reconectar
    const openRef = useRef(open);
    useEffect(() => { openRef.current = open; }, [open]);

    const isAdminRoute = pathname?.startsWith('/admin');
    const isFullScreenRoute = pathname?.startsWith('/sorteos/temporada');
    const isLoggedInCustomer = authStatus === 'authenticated' && session?.user?.role === 'customer';
    const isAnonymous = authStatus !== 'authenticated';

    useEffect(() => {
        setHasMounted(true);
        guestIdRef.current = getGuestId();
        const wasOpen = localStorage.getItem(OPEN_KEY) === '1';
        if (wasOpen) setOpen(true);
    }, []);

    useEffect(() => {
        if (!hasMounted) return;
        localStorage.setItem(OPEN_KEY, open ? '1' : '0');
        if (open) setUnread(0);
    }, [open, hasMounted]);

    // Scroll al final cuando llegan mensajes o se abre el chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, open]);

    const initConversation = useCallback(async () => {
        if (initRef.current) return;
        if (isAnonymous && !guestName.trim()) {
            setNeedsName(true);
            return;
        }
        initRef.current = true;
        setLoading(true);
        try {
            const res = await fetch('/api/chat/conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-chat-guest-id': guestIdRef.current,
                },
                body: JSON.stringify({
                    guestId: guestIdRef.current,
                    guestName: isAnonymous ? guestName.trim() : null,
                }),
            });
            if (!res.ok) {
                initRef.current = false;
                return;
            }
            const data = await res.json();
            setConversationId(data.conversation.id);
            setConversationStatus(data.conversation.status === 'closed' ? 'closed' : 'open');
            setMessages(data.messages.map((m: any) => ({
                ...m,
                messageType: m.messageType || 'text',
                attachmentUrl: m.attachmentUrl ?? null,
                attachmentName: m.attachmentName ?? null,
                attachmentSize: m.attachmentSize ?? null,
                mimeType: m.mimeType ?? null,
                pending: false,
            })));
            setNeedsName(false);
        } catch {
            initRef.current = false;
        } finally {
            setLoading(false);
        }
    }, [isAnonymous, guestName]);

    // Crear/recuperar conversación cuando se abre el widget
    useEffect(() => {
        if (!open || !hasMounted || authStatus === 'loading') return;
        if (conversationId) return;
        if (isAnonymous && !guestName.trim()) {
            setNeedsName(true);
            return;
        }
        initConversation();
    }, [open, hasMounted, authStatus, conversationId, isAnonymous, guestName, initConversation]);

    // Manejo de eventos SSE (mensajes nuevos, cierre, reapertura)
    const handleSSEEvent = useCallback((event: ChatSSEEvent) => {
        switch (event.type) {
            case 'message_created': {
                const msg = event.message;
                setMessages(prev => {
                    // Dedup por id real
                    if (prev.some(m => m.id === msg.id)) return prev;
                    // Reemplazar el optimista propio: para texto comparamos body,
                    // para adjuntos comparamos por messageType + attachmentName + size.
                    const idx = prev.findIndex(m => {
                        if (!m.pending || m.senderType !== msg.senderType) return false;
                        if (msg.messageType === 'text') return m.body === msg.body && m.messageType === 'text';
                        return (
                            m.messageType === msg.messageType &&
                            m.attachmentName === msg.attachmentName &&
                            m.attachmentSize === msg.attachmentSize
                        );
                    });
                    if (idx >= 0) {
                        // Liberar el preview blob: si existía
                        const prevMsg = prev[idx];
                        if (prevMsg.localPreviewUrl) URL.revokeObjectURL(prevMsg.localPreviewUrl);
                        const copy = prev.slice();
                        copy[idx] = { ...msg, pending: false };
                        return copy;
                    }
                    return [...prev, { ...msg, pending: false }];
                });
                if (msg.senderType === 'agent' && !openRef.current) {
                    setUnread(u => u + 1);
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        try {
                            const body = msg.messageType === 'image'
                                ? '📷 Te enviaron una imagen'
                                : msg.messageType === 'file'
                                    ? `📎 ${msg.attachmentName || 'Archivo'}`
                                    : msg.body.slice(0, 80);
                            new Notification('MiniVeci · Nuevo mensaje', { body });
                        } catch { /* noop */ }
                    }
                }
                break;
            }
            case 'conversation_closed': {
                setConversationStatus('closed');
                break;
            }
            case 'conversation_reopened': {
                setConversationStatus('open');
                break;
            }
            default:
                break;
        }
    }, []);

    const sseUrl = conversationId
        ? `/api/chat/conversation/${conversationId}/events?guestId=${encodeURIComponent(guestIdRef.current)}`
        : null;

    useChatSSE({
        url: sseUrl,
        enabled: !!conversationId,
        onEvent: handleSSEEvent,
    });

    // Pedir permiso de notificaciones al abrir
    useEffect(() => {
        if (open && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => { });
        }
    }, [open]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || !conversationId || sending) return;
        if (conversationStatus === 'closed') return;
        setSending(true);
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimistic: ChatMessage = {
            id: tempId,
            tempId,
            senderType: 'customer',
            senderName: null,
            body: text,
            messageType: 'text',
            attachmentUrl: null,
            attachmentName: null,
            attachmentSize: null,
            mimeType: null,
            createdAt: new Date().toISOString(),
            pending: true,
        };
        setMessages(prev => [...prev, optimistic]);
        setInput('');
        try {
            const res = await fetch(`/api/chat/conversation/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-chat-guest-id': guestIdRef.current,
                },
                body: JSON.stringify({ body: text, guestId: guestIdRef.current }),
            });
            if (res.ok) {
                const real = await res.json() as ChatMessage;
                setMessages(prev => {
                    if (prev.some(m => m.id === real.id)) {
                        return prev.filter(m => m.id !== tempId);
                    }
                    const idx = prev.findIndex(m => m.id === tempId);
                    if (idx >= 0) {
                        const copy = prev.slice();
                        copy[idx] = { ...real, pending: false };
                        return copy;
                    }
                    return [...prev, { ...real, pending: false }];
                });
            } else {
                setMessages(prev => prev.filter(m => m.id !== tempId));
                setInput(text);
            }
        } catch {
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setInput(text);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleFilePick = () => {
        if (!conversationId || conversationStatus === 'closed' || uploading) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // permitir reseleccionar el mismo archivo
        if (!file || !conversationId) return;

        const validation = validateChatFile(file);
        if (!validation.ok) {
            setUploadError(validation.error);
            setTimeout(() => setUploadError(null), 4000);
            return;
        }

        const isImage = file.type.startsWith('image/');
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const localPreviewUrl = isImage ? URL.createObjectURL(file) : undefined;
        const optimistic: ChatMessage = {
            id: tempId,
            tempId,
            senderType: 'customer',
            senderName: null,
            body: '',
            messageType: isImage ? 'image' : 'file',
            attachmentUrl: localPreviewUrl ?? null,
            attachmentName: file.name,
            attachmentSize: file.size,
            mimeType: file.type,
            createdAt: new Date().toISOString(),
            pending: true,
            localPreviewUrl,
            uploadProgress: 0,
        };
        setMessages(prev => [...prev, optimistic]);
        setUploadError(null);

        try {
            const real = await upload({
                url: `/api/chat/conversation/${conversationId}/attachments`,
                file,
                extra: { guestId: guestIdRef.current },
            });
            setMessages(prev => {
                // Si SSE ya lo añadió, eliminar el temp
                if (prev.some(m => m.id === real.id)) {
                    const filtered = prev.filter(m => m.id !== tempId);
                    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
                    return filtered;
                }
                const idx = prev.findIndex(m => m.id === tempId);
                if (idx >= 0) {
                    const copy = prev.slice();
                    copy[idx] = {
                        ...(real as ChatMessage),
                        pending: false,
                    };
                    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
                    return copy;
                }
                return prev;
            });
        } catch (err: any) {
            setMessages(prev => prev.filter(m => m.id !== tempId));
            if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
            setUploadError(err?.message || 'Error subiendo archivo');
            setTimeout(() => setUploadError(null), 4000);
        }
    };

    // Mantener el % visible mientras sube
    useEffect(() => {
        if (!uploading) return;
        setMessages(prev => {
            const idx = prev.findIndex(m => m.pending && m.messageType !== 'text');
            if (idx < 0) return prev;
            const copy = prev.slice();
            copy[idx] = { ...copy[idx], uploadProgress };
            return copy;
        });
    }, [uploading, uploadProgress]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // No renderizar en admin
    if (!hasMounted || isAdminRoute || isFullScreenRoute) return null;

    const isClosed = conversationStatus === 'closed';

    return (
        <>
            {/* Botón flotante */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-5 right-5 z-[55] group flex items-center gap-2 pr-5 pl-4 py-3 rounded-full bg-gradient-to-r from-veci-primary to-fuchsia-400 text-white font-bold shadow-xl shadow-veci-primary/40 hover:shadow-2xl hover:scale-105 transition-all"
                    aria-label="Abrir chat de soporte"
                >
                    <div className="relative">
                        <MessageCircle className="w-5 h-5" />
                        {unread > 0 && (
                            <span className="absolute -top-2 -right-2 bg-white text-veci-primary text-[10px] font-extrabold min-w-[18px] h-[18px] rounded-full inline-flex items-center justify-center px-1 shadow-sm ring-2 ring-white">
                                {unread}
                            </span>
                        )}
                    </div>
                    <span className="text-sm hidden sm:block">¿Necesitas ayuda?</span>
                </button>
            )}

            {/* Panel del chat */}
            {open && (
                <div className="fixed bottom-5 right-5 z-[55] w-[calc(100vw-2.5rem)] sm:w-[380px] h-[min(600px,calc(100vh-2.5rem))] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                    {/* Header */}
                    <div className="relative px-5 py-4 bg-gradient-to-br from-veci-primary via-rose-400 to-fuchsia-400 text-white overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <MessageCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-base leading-tight">Soporte MiniVeci</p>
                                    <p className="text-[11px] text-white/85 flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                        Respondemos en minutos
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                                aria-label="Cerrar chat"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Mensajes */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-slate-50 to-white space-y-3">
                        {needsName ? (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
                                <div className="w-16 h-16 rounded-full bg-veci-primary/10 flex items-center justify-center">
                                    <MessageCircle className="w-7 h-7 text-veci-primary" />
                                </div>
                                <p className="text-sm font-bold text-slate-800">Hola, ¿cómo te llamamos?</p>
                                <p className="text-xs text-slate-500">Para empezar la conversación necesitamos tu nombre.</p>
                                <input
                                    type="text"
                                    placeholder="Tu nombre"
                                    value={guestName}
                                    onChange={e => setGuestName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && guestName.trim()) {
                                            initConversation();
                                        }
                                    }}
                                    className="w-full max-w-xs px-4 py-2.5 rounded-full bg-white border border-slate-200 focus:border-veci-primary focus:outline-none focus:ring-2 focus:ring-veci-primary/20 text-sm"
                                    autoFocus
                                />
                                <button
                                    onClick={() => initConversation()}
                                    disabled={!guestName.trim()}
                                    className="px-6 py-2 rounded-full bg-veci-primary text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-veci-primary/90 transition-colors"
                                >
                                    Empezar
                                </button>
                            </div>
                        ) : loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-6 h-6 text-veci-primary animate-spin" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
                                <div className="w-16 h-16 rounded-full bg-veci-primary/10 flex items-center justify-center">
                                    <MessageCircle className="w-7 h-7 text-veci-primary" />
                                </div>
                                <p className="text-sm font-bold text-slate-800">¡Hola! ¿En qué te ayudamos?</p>
                                <p className="text-xs text-slate-500 max-w-[16rem]">Escríbenos y un asesor te responderá pronto.</p>
                            </div>
                        ) : (
                            messages.map((m, idx) => {
                                const isCustomer = m.senderType === 'customer';
                                const isSystem = m.senderType === 'system';
                                const prev = messages[idx - 1];
                                const sameAuthorAsPrev = prev && prev.senderType === m.senderType;

                                if (isSystem) {
                                    return (
                                        <div key={m.id} className="flex justify-center">
                                            <span className="text-[11px] text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                                                {m.body}
                                            </span>
                                        </div>
                                    );
                                }

                                const isAttachment = m.messageType !== 'text';
                                return (
                                    <div key={m.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'} ${sameAuthorAsPrev ? 'mt-1' : 'mt-3'}`}>
                                        <div className={`max-w-[80%] ${isCustomer ? 'items-end' : 'items-start'} flex flex-col`}>
                                            {!sameAuthorAsPrev && !isCustomer && m.senderName && (
                                                <span className="text-[10px] font-bold text-slate-500 px-3 mb-0.5">{m.senderName}</span>
                                            )}
                                            {isAttachment ? (
                                                <div className={`${m.messageType === 'image' ? '' : (isCustomer
                                                    ? 'bg-gradient-to-br from-veci-primary to-fuchsia-400 rounded-br-sm shadow-sm'
                                                    : 'bg-white border border-slate-100 rounded-bl-sm shadow-sm')} ${m.messageType === 'image' ? '' : 'rounded-2xl p-1'}`}>
                                                    <ChatAttachment
                                                        messageType={m.messageType}
                                                        url={m.attachmentUrl}
                                                        name={m.attachmentName}
                                                        size={m.attachmentSize}
                                                        mimeType={m.mimeType}
                                                        variant={isCustomer ? 'sender' : 'receiver'}
                                                        pending={m.pending}
                                                        progress={m.uploadProgress}
                                                        onOpenImage={(url) => setLightboxUrl(url)}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`px-3.5 py-2 text-sm leading-relaxed rounded-2xl ${isCustomer
                                                        ? 'bg-gradient-to-br from-veci-primary to-fuchsia-400 text-white rounded-br-sm shadow-sm'
                                                        : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm'
                                                        } ${m.pending ? 'opacity-70' : ''}`}
                                                >
                                                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                                </div>
                                            )}
                                            <div className={`flex items-center gap-1 mt-0.5 px-1.5 ${isCustomer ? 'flex-row-reverse' : ''}`}>
                                                <span className="text-[10px] text-slate-400">{formatTime(m.createdAt)}</span>
                                                {isCustomer && (
                                                    m.pending
                                                        ? <Loader2 className="w-2.5 h-2.5 text-slate-400 animate-spin" />
                                                        : <CheckCheck className="w-3 h-3 text-veci-primary" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Input */}
                    {!needsName && (
                        <div className="border-t border-slate-100 bg-white p-3">
                            {isClosed ? (
                                <div className="text-center py-2">
                                    <p className="text-xs text-slate-500 font-semibold">Conversación cerrada por soporte</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-end gap-2 bg-slate-50 rounded-2xl px-2 py-2 border border-slate-100 focus-within:border-veci-primary focus-within:bg-white transition-colors">
                                        <button
                                            type="button"
                                            onClick={handleFilePick}
                                            disabled={!conversationId || uploading}
                                            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-white hover:text-veci-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            aria-label="Adjuntar archivo"
                                            title="Adjuntar imagen o PDF"
                                        >
                                            <Paperclip className="w-4 h-4" />
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,application/pdf"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        <textarea
                                            ref={inputRef}
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Escribe un mensaje..."
                                            rows={1}
                                            maxLength={2000}
                                            disabled={!conversationId || sending}
                                            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-slate-700 placeholder:text-slate-400 max-h-24"
                                        />
                                        <button
                                            onClick={sendMessage}
                                            disabled={!input.trim() || !conversationId || sending}
                                            className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-veci-primary to-fuchsia-400 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100 transition-all"
                                            aria-label="Enviar"
                                        >
                                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {uploadError ? (
                                        <p className="text-[10px] text-red-500 text-center mt-1.5 font-semibold">{uploadError}</p>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 text-center mt-1.5">
                                            Enter para enviar · 📎 imagen / PDF (máx 5 MB)
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {lightboxUrl && (
                <ChatLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
            )}
        </>
    );
}

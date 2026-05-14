'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MessageCircle, X, Send, Loader2, CheckCheck } from 'lucide-react';

interface ChatMessage {
    id: string;
    senderType: 'customer' | 'agent' | 'system';
    senderName: string | null;
    body: string;
    createdAt: string;
    pending?: boolean;
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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [needsName, setNeedsName] = useState(false);
    const [unread, setUnread] = useState(0);
    const [hasMounted, setHasMounted] = useState(false);
    const guestIdRef = useRef<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const initRef = useRef(false);

    const isAdminRoute = pathname?.startsWith('/admin');
    const isCheckoutRoute = pathname?.startsWith('/carrito') || pathname?.startsWith('/checkout');
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

    // Scroll al final cuando llegan mensajes
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
            setMessages(data.messages);
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

    // SSE para mensajes en tiempo real
    useEffect(() => {
        if (!conversationId) return;
        const url = `/api/chat/conversation/${conversationId}/events?guestId=${encodeURIComponent(guestIdRef.current)}`;
        const es = new EventSource(url);
        es.addEventListener('message', (e: MessageEvent) => {
            try {
                const msg = JSON.parse(e.data) as ChatMessage;
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    // Reemplazar pending si existe (eco del propio mensaje)
                    const withoutPending = prev.filter(m => !m.pending || m.body !== msg.body);
                    return [...withoutPending, msg];
                });
                if (msg.senderType === 'agent' && !open) {
                    setUnread(u => u + 1);
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        new Notification('MiniVeci · Nuevo mensaje', { body: msg.body.slice(0, 80) });
                    }
                }
            } catch {}
        });
        return () => es.close();
    }, [conversationId, open]);

    // Pedir permiso de notificaciones al abrir
    useEffect(() => {
        if (open && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, [open]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || !conversationId || sending) return;
        setSending(true);
        const tempId = `temp-${Date.now()}`;
        const optimistic: ChatMessage = {
            id: tempId,
            senderType: 'customer',
            senderName: null,
            body: text,
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
            if (!res.ok) {
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // No renderizar en admin
    if (!hasMounted || isAdminRoute) return null;

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

                                return (
                                    <div key={m.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'} ${sameAuthorAsPrev ? 'mt-1' : 'mt-3'}`}>
                                        <div className={`max-w-[80%] ${isCustomer ? 'items-end' : 'items-start'} flex flex-col`}>
                                            {!sameAuthorAsPrev && !isCustomer && m.senderName && (
                                                <span className="text-[10px] font-bold text-slate-500 px-3 mb-0.5">{m.senderName}</span>
                                            )}
                                            <div
                                                className={`px-3.5 py-2 text-sm leading-relaxed rounded-2xl ${isCustomer
                                                    ? 'bg-gradient-to-br from-veci-primary to-fuchsia-400 text-white rounded-br-sm shadow-sm'
                                                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm'
                                                    } ${m.pending ? 'opacity-70' : ''}`}
                                            >
                                                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                            </div>
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
                            <div className="flex items-end gap-2 bg-slate-50 rounded-2xl px-3 py-2 border border-slate-100 focus-within:border-veci-primary focus-within:bg-white transition-colors">
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
                            <p className="text-[10px] text-slate-400 text-center mt-1.5">
                                Enter para enviar · Shift+Enter para nueva línea
                            </p>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
    MessageCircle, Send, Loader2, Search, Phone, Mail, MapPin, Package, User,
    CheckCheck, Inbox, XCircle, RotateCcw, ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface ConversationListItem {
    id: string;
    status: 'open' | 'closed';
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    unreadAgent: number;
    assignedOperatorId: string | null;
    createdAt: string;
    customer: { id: string; name: string; email: string; phone: string | null } | null;
    guest: { id: string | null; name: string | null; email: string | null } | null;
}

interface ChatMessage {
    id: string;
    conversationId?: string;
    senderType: 'customer' | 'agent' | 'system';
    senderId: string | null;
    senderName: string | null;
    body: string;
    createdAt: string;
    pending?: boolean;
}

interface ConversationDetail {
    conversation: {
        id: string;
        status: 'open' | 'closed';
        createdAt: string;
        lastMessageAt: string | null;
        guest: { id: string | null; name: string | null; email: string | null } | null;
    };
    customer: {
        id: string; name: string; email: string; phone: string | null;
        address: string | null; comuna: string | null; city: string | null;
    } | null;
    stats: { totalOrders: number; totalSpent: number } | null;
    recentOrders: { id: string; orderNumber: string; status: string; total: number; createdAt: string }[];
    messages: ChatMessage[];
}

const fmtCLP = (v: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);

function timeAgo(iso: string | null): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    const d = Math.floor(h / 24);
    return `hace ${d}d`;
}

function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function getDisplayName(c: ConversationListItem): string {
    return c.customer?.name || c.guest?.name || 'Visitante';
}

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function SoporteClient() {
    const [conversations, setConversations] = useState<ConversationListItem[]>([]);
    const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<ConversationDetail | null>(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [showInfoPanel, setShowInfoPanel] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const fetchList = useCallback(async () => {
        setLoadingList(true);
        try {
            const res = await fetch(`/api/admin/chat/conversations?status=${statusFilter}`);
            if (res.ok) {
                const data = await res.json();
                setConversations(data.conversations);
            }
        } finally {
            setLoadingList(false);
        }
    }, [statusFilter]);

    const fetchDetail = useCallback(async (id: string) => {
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/admin/chat/conversations/${id}`);
            if (res.ok) {
                const data = await res.json();
                setDetail(data);
                // Marcar visualmente como leído en la lista
                setConversations(prev =>
                    prev.map(c => c.id === id ? { ...c, unreadAgent: 0 } : c)
                );
            }
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    useEffect(() => { fetchList(); }, [fetchList]);
    useEffect(() => {
        if (selectedId) fetchDetail(selectedId);
        else setDetail(null);
    }, [selectedId, fetchDetail]);

    // SSE global
    useEffect(() => {
        const es = new EventSource('/api/admin/chat/events');
        es.addEventListener('chat-event', (e: MessageEvent) => {
            try {
                const event = JSON.parse(e.data);
                if (event.type === 'message-created' && event.message) {
                    const msg = event.message as ChatMessage;
                    // Si pertenece a la conversación abierta, agregarlo
                    if (selectedId && msg.conversationId === selectedId) {
                        setDetail(prev => {
                            if (!prev) return prev;
                            if (prev.messages.some(m => m.id === msg.id)) return prev;
                            const filtered = prev.messages.filter(m => !m.pending || m.body !== msg.body);
                            return { ...prev, messages: [...filtered, msg] };
                        });
                    }
                    // Refrescar lista (preview + unread)
                    setConversations(prev => {
                        const exists = prev.find(c => c.id === msg.conversationId);
                        if (!exists) {
                            // Conversación nueva: refrescar lista
                            fetchList();
                            return prev;
                        }
                        return prev.map(c => c.id === msg.conversationId
                            ? {
                                ...c,
                                lastMessageAt: msg.createdAt,
                                lastMessagePreview: msg.body.slice(0, 140),
                                unreadAgent: msg.senderType === 'customer' && msg.conversationId !== selectedId
                                    ? c.unreadAgent + 1
                                    : c.unreadAgent,
                            }
                            : c
                        ).sort((a, b) => {
                            const aT = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                            const bT = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                            return bT - aT;
                        });
                    });
                    // Notificación
                    if (msg.senderType === 'customer' && msg.conversationId !== selectedId) {
                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            new Notification(`${msg.senderName || 'Cliente'}`, { body: msg.body.slice(0, 80) });
                        }
                    }
                }
            } catch {}
        });
        return () => es.close();
    }, [selectedId, fetchList]);

    // Permiso de notificaciones
    useEffect(() => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, []);

    // Scroll al final
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [detail?.messages.length]);

    const filteredConversations = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter(c => {
            const name = getDisplayName(c).toLowerCase();
            const email = (c.customer?.email || c.guest?.email || '').toLowerCase();
            const preview = (c.lastMessagePreview || '').toLowerCase();
            return name.includes(q) || email.includes(q) || preview.includes(q);
        });
    }, [conversations, search]);

    const sendReply = async () => {
        const text = input.trim();
        if (!text || !selectedId || sending) return;
        setSending(true);
        const tempId = `temp-${Date.now()}`;
        const optimistic: ChatMessage = {
            id: tempId,
            senderType: 'agent',
            senderId: null,
            senderName: 'Tú',
            body: text,
            createdAt: new Date().toISOString(),
            pending: true,
        };
        setDetail(prev => prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev);
        setInput('');
        try {
            const res = await fetch(`/api/admin/chat/conversations/${selectedId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: text }),
            });
            if (!res.ok) {
                setDetail(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== tempId) } : prev);
                setInput(text);
                toast.error('Error al enviar');
            }
        } catch {
            setDetail(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== tempId) } : prev);
            setInput(text);
            toast.error('Error al enviar');
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const toggleStatus = async (newStatus: 'open' | 'closed') => {
        if (!selectedId) return;
        try {
            const res = await fetch(`/api/admin/chat/conversations/${selectedId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                toast.success(newStatus === 'closed' ? 'Conversación cerrada' : 'Conversación reabierta');
                fetchDetail(selectedId);
                fetchList();
            }
        } catch {
            toast.error('Error');
        }
    };

    return (
        <div className="flex h-full bg-slate-50">
            {/* Lista de conversaciones */}
            <aside className="w-80 border-r border-slate-200 bg-white flex flex-col">
                <div className="px-4 py-4 border-b border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-extrabold text-slate-800">Conversaciones</h2>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {conversations.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg">
                        {(['open', 'closed', 'all'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${
                                    statusFilter === s
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {s === 'open' ? 'Activas' : s === 'closed' ? 'Cerradas' : 'Todas'}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-veci-primary focus:outline-none focus:ring-2 focus:ring-veci-primary/20"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loadingList ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                            <Inbox className="w-10 h-10" strokeWidth={1.2} />
                            <p className="text-sm font-medium">Sin conversaciones</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {filteredConversations.map(c => {
                                const name = getDisplayName(c);
                                const isSelected = c.id === selectedId;
                                const hasUnread = c.unreadAgent > 0;
                                return (
                                    <li key={c.id}>
                                        <button
                                            onClick={() => setSelectedId(c.id)}
                                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 ${
                                                isSelected ? 'bg-veci-primary/5 border-l-4 border-veci-primary' : ''
                                            }`}
                                        >
                                            <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                                                c.customer
                                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-500'
                                                    : 'bg-gradient-to-br from-slate-400 to-slate-500'
                                            }`}>
                                                {getInitials(name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-sm font-bold truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                                                        {name}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 shrink-0">
                                                        {timeAgo(c.lastMessageAt || c.createdAt)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                                    <p className={`text-xs truncate ${hasUnread ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>
                                                        {c.lastMessagePreview || (c.customer ? 'Cliente registrado' : 'Visitante')}
                                                    </p>
                                                    {hasUnread && (
                                                        <span className="shrink-0 bg-veci-primary text-white text-[10px] font-extrabold min-w-[18px] h-[18px] rounded-full inline-flex items-center justify-center px-1">
                                                            {c.unreadAgent}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </aside>

            {/* Conversación activa */}
            <section className="flex-1 flex flex-col bg-white">
                {!selectedId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-veci-primary/20 to-fuchsia-200/40 flex items-center justify-center">
                            <MessageCircle className="w-9 h-9 text-veci-primary" strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-lg font-extrabold text-slate-800">Selecciona una conversación</p>
                            <p className="text-sm text-slate-500 max-w-sm mt-1">
                                Elige un cliente de la lista para empezar a chatear en tiempo real.
                            </p>
                        </div>
                    </div>
                ) : loadingDetail || !detail ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedId(null)}
                                    className="lg:hidden w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                    {getInitials(detail.customer?.name || detail.conversation.guest?.name || 'V')}
                                </div>
                                <div>
                                    <p className="font-extrabold text-slate-800 leading-tight">
                                        {detail.customer?.name || detail.conversation.guest?.name || 'Visitante anónimo'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {detail.customer
                                            ? `Cliente · ${detail.customer.email}`
                                            : 'Visitante sin cuenta'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {detail.conversation.status === 'open' ? (
                                    <button
                                        onClick={() => toggleStatus('closed')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> Cerrar
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => toggleStatus('open')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Reabrir
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowInfoPanel(p => !p)}
                                    className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    <User className="w-3.5 h-3.5" />
                                    {showInfoPanel ? 'Ocultar info' : 'Ver info'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Mensajes */}
                            <div className="flex-1 flex flex-col">
                                <div className="flex-1 overflow-y-auto px-6 py-5 bg-gradient-to-b from-slate-50 to-white space-y-3">
                                    {detail.messages.length === 0 ? (
                                        <div className="text-center text-sm text-slate-400 py-10">
                                            Sin mensajes todavía.
                                        </div>
                                    ) : detail.messages.map((m, idx) => {
                                        const isAgent = m.senderType === 'agent';
                                        const prev = detail.messages[idx - 1];
                                        const sameAuthor = prev && prev.senderType === m.senderType;

                                        return (
                                            <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'} ${sameAuthor ? 'mt-1' : 'mt-3'}`}>
                                                <div className={`max-w-[70%] ${isAgent ? 'items-end' : 'items-start'} flex flex-col`}>
                                                    {!sameAuthor && (
                                                        <span className="text-[10px] font-bold text-slate-500 px-3 mb-0.5">
                                                            {m.senderName || (isAgent ? 'Soporte' : 'Cliente')}
                                                        </span>
                                                    )}
                                                    <div className={`px-3.5 py-2 text-sm leading-relaxed rounded-2xl ${
                                                        isAgent
                                                            ? 'bg-gradient-to-br from-veci-primary to-fuchsia-400 text-white rounded-br-sm shadow-sm'
                                                            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm'
                                                    } ${m.pending ? 'opacity-70' : ''}`}>
                                                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                                    </div>
                                                    <div className={`flex items-center gap-1 mt-0.5 px-1.5 ${isAgent ? 'flex-row-reverse' : ''}`}>
                                                        <span className="text-[10px] text-slate-400">{formatTime(m.createdAt)}</span>
                                                        {isAgent && (
                                                            m.pending
                                                                ? <Loader2 className="w-2.5 h-2.5 text-slate-400 animate-spin" />
                                                                : <CheckCheck className="w-3 h-3 text-veci-primary" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                {detail.conversation.status === 'open' ? (
                                    <div className="border-t border-slate-100 bg-white p-4">
                                        <div className="flex items-end gap-2 bg-slate-50 rounded-2xl px-3 py-2 border border-slate-100 focus-within:border-veci-primary focus-within:bg-white transition-colors">
                                            <textarea
                                                ref={inputRef}
                                                value={input}
                                                onChange={e => setInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        sendReply();
                                                    }
                                                }}
                                                placeholder="Responder al cliente..."
                                                rows={1}
                                                maxLength={2000}
                                                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-slate-700 placeholder:text-slate-400 max-h-32"
                                            />
                                            <button
                                                onClick={sendReply}
                                                disabled={!input.trim() || sending}
                                                className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-veci-primary to-fuchsia-400 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100 transition-all"
                                            >
                                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center">
                                        <p className="text-sm font-semibold text-slate-500">Conversación cerrada</p>
                                        <button
                                            onClick={() => toggleStatus('open')}
                                            className="text-xs font-bold text-veci-primary hover:underline mt-1"
                                        >
                                            Reabrir para responder
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Panel de info del cliente */}
                            {showInfoPanel && (
                                <aside className="hidden lg:flex w-80 border-l border-slate-200 flex-col bg-slate-50 overflow-y-auto">
                                    <div className="px-5 py-4">
                                        {detail.customer ? (
                                            <>
                                                <div className="text-center">
                                                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                                        {getInitials(detail.customer.name)}
                                                    </div>
                                                    <p className="font-extrabold text-slate-800 mt-3">{detail.customer.name}</p>
                                                    <p className="text-xs text-slate-500">Cliente registrado</p>
                                                </div>

                                                <div className="mt-5 space-y-2.5 bg-white p-4 rounded-2xl border border-slate-100">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-slate-700 truncate">{detail.customer.email}</span>
                                                    </div>
                                                    {detail.customer.phone && (
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                            <span className="text-slate-700">{detail.customer.phone}</span>
                                                        </div>
                                                    )}
                                                    {detail.customer.address && (
                                                        <div className="flex items-start gap-2 text-xs">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                                            <span className="text-slate-700">
                                                                {detail.customer.address}
                                                                {detail.customer.comuna && `, ${detail.customer.comuna}`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {detail.stats && (
                                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                                        <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Pedidos</p>
                                                            <p className="text-lg font-extrabold text-slate-800 mt-0.5">{detail.stats.totalOrders}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Gastado</p>
                                                            <p className="text-sm font-extrabold text-slate-800 mt-0.5 tabular-nums">{fmtCLP(detail.stats.totalSpent)}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {detail.recentOrders.length > 0 && (
                                                    <div className="mt-4">
                                                        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                                                            <Package className="w-3 h-3" /> Pedidos recientes
                                                        </p>
                                                        <ul className="space-y-1.5">
                                                            {detail.recentOrders.map(o => (
                                                                <li key={o.id} className="bg-white p-2.5 rounded-xl border border-slate-100">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-bold text-slate-700">#{o.orderNumber}</span>
                                                                        <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                                            {o.status}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{fmtCLP(o.total)}</p>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center">
                                                <div className="w-16 h-16 mx-auto rounded-full bg-slate-200 flex items-center justify-center">
                                                    <User className="w-7 h-7 text-slate-400" />
                                                </div>
                                                <p className="font-extrabold text-slate-800 mt-3">Visitante anónimo</p>
                                                <p className="text-xs text-slate-500 mt-1 max-w-[14rem] mx-auto">
                                                    {detail.conversation.guest?.name && `Se identificó como ${detail.conversation.guest.name}.`}
                                                </p>
                                                {detail.conversation.guest?.email && (
                                                    <div className="flex items-center justify-center gap-2 text-xs mt-3 bg-white p-2 rounded-lg border border-slate-100">
                                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-slate-700">{detail.conversation.guest.email}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </aside>
                            )}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

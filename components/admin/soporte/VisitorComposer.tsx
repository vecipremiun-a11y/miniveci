'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Eye, Loader2, MapPin, Send, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import type { OnlineVisitor } from '@/hooks/use-visitor-presence';
import {
    deviceIcon, deviceLabel, flagEmoji, fullLocationLabel, timeOnSite, visitorInitials,
} from './visitor-format';

/**
 * Cuadro para escribirle primero a alguien que está navegando y todavía no ha
 * dicho nada. Al enviar se crea la conversación y el panel salta a ella, así
 * que este cuadro se ve una sola vez por visitante.
 */

/** Aperturas típicas, para no escribir lo mismo veinte veces al día. */
const QUICK_REPLIES = [
    '¡Hola! ¿Te ayudo a encontrar algo?',
    '¿Tienes alguna duda con tu pedido?',
    'Cualquier cosa que necesites, estoy por acá 😊',
];

interface VisitorComposerProps {
    visitor: OnlineVisitor;
    /** Se llama con la conversación recién creada para abrirla en el panel. */
    onSent: (conversationId: string) => void;
}

export function VisitorComposer({ visitor, onSent }: VisitorComposerProps) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const DeviceIcon = deviceIcon(visitor.device);
    const isOnline = visitor.status === 'online';
    const name = visitor.name || 'Visitante anónimo';

    // Al cambiar de visitante se limpia lo escrito: nada peor que mandarle a
    // uno el mensaje que era para otro.
    useEffect(() => {
        setText('');
        inputRef.current?.focus();
    }, [visitor.guestId]);

    const send = async () => {
        const body = text.trim();
        if (!body || sending) return;
        setSending(true);
        try {
            const res = await fetch(
                `/api/admin/chat/visitors/${encodeURIComponent(visitor.guestId)}/message`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ body }),
                },
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || 'No se pudo enviar el mensaje');
                return;
            }
            const data = await res.json();
            setText('');
            toast.success('Mensaje enviado');
            onSent(data.conversationId);
        } catch {
            toast.error('Error de conexión');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
            <div className="w-full max-w-lg">
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${visitor.customerId
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-500'
                            : 'bg-gradient-to-br from-slate-400 to-slate-500'
                            }`}>
                            {visitorInitials(visitor)}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-amber-400'
                            }`} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-lg font-extrabold text-slate-800 truncate">{name}</p>
                        <p className="text-xs text-slate-500">
                            {isOnline ? 'En línea ahora' : 'Inactivo hace un rato'}
                            {visitor.email ? ` · ${visitor.email}` : ''}
                        </p>
                    </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                        <dt className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                            <MapPin className="w-3 h-3" /> Ubicación
                        </dt>
                        <dd className="text-sm text-slate-700 mt-1 truncate">
                            <span aria-hidden>{flagEmoji(visitor.country)}</span> {fullLocationLabel(visitor)}
                        </dd>
                        {visitor.ipMasked && (
                            <dd className="text-[11px] text-slate-400 mt-0.5">IP {visitor.ipMasked}</dd>
                        )}
                    </div>

                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                        <dt className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                            <DeviceIcon className="w-3 h-3" /> Dispositivo
                        </dt>
                        <dd className="text-sm text-slate-700 mt-1 truncate">{deviceLabel(visitor)}</dd>
                        {visitor.timezone && (
                            <dd className="text-[11px] text-slate-400 mt-0.5 truncate">{visitor.timezone}</dd>
                        )}
                    </div>

                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                        <dt className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                            <Eye className="w-3 h-3" /> Viendo ahora
                        </dt>
                        <dd className="text-sm text-slate-700 mt-1 truncate font-mono" title={visitor.pageTitle || undefined}>
                            {visitor.currentPath || '—'}
                        </dd>
                        <dd className="text-[11px] text-slate-400 mt-0.5">
                            {visitor.pageViews} {visitor.pageViews === 1 ? 'página' : 'páginas'} en esta visita
                        </dd>
                    </div>

                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                        <dt className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                            <Clock className="w-3 h-3" /> Tiempo
                        </dt>
                        <dd className="text-sm text-slate-700 mt-1">{timeOnSite(visitor.firstSeenAt)}</dd>
                        {visitor.landingPath && (
                            <dd className="text-[11px] text-slate-400 mt-0.5 truncate">
                                entró por {visitor.landingPath}
                            </dd>
                        )}
                    </div>
                </dl>

                {visitor.referrer && (
                    <p className="flex items-center gap-1.5 mt-3 text-xs text-slate-400 truncate">
                        <Link2 className="w-3 h-3 shrink-0" /> Llegó desde {visitor.referrer}
                    </p>
                )}

                <div className="mt-6">
                    <p className="text-sm font-bold text-slate-700">Escríbele primero</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Se le abre el chat en la tienda con tu mensaje. Aún no ha escrito nada.
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                        {QUICK_REPLIES.map(reply => (
                            <button
                                key={reply}
                                onClick={() => { setText(reply); inputRef.current?.focus(); }}
                                className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:border-veci-primary hover:text-veci-primary transition-colors"
                            >
                                {reply}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                            rows={3}
                            maxLength={2000}
                            placeholder="Hola, ¿te ayudo en algo?"
                            className="flex-1 resize-none px-3 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-veci-primary focus:outline-none focus:ring-2 focus:ring-veci-primary/20"
                        />
                        <button
                            onClick={send}
                            disabled={!text.trim() || sending}
                            className="shrink-0 w-11 h-11 rounded-xl bg-veci-primary text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
                            title="Enviar (Enter)"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

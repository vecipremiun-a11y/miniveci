'use client';

import { Loader2, MessageCircle, PenLine, Users } from 'lucide-react';
import type { OnlineVisitor } from '@/hooks/use-visitor-presence';
import {
    countryName, deviceIcon, flagEmoji, lastSeenLabel, locationLabel, timeOnSite, visitorInitials,
} from './visitor-format';

/**
 * Lista de visitantes navegando el sitio ahora. Al hacer click se abre su
 * conversación si ya existe, o el cuadro para escribirle primero si nunca ha
 * hablado.
 */

/** Lo que no cabe en la fila, al pasar el mouse por encima. */
function detailTooltip(visitor: OnlineVisitor): string {
    return [
        [visitor.city, visitor.countryRegion, countryName(visitor.country)].filter(Boolean).join(', '),
        visitor.ipMasked ? `IP ${visitor.ipMasked}` : null,
        visitor.timezone,
        visitor.landingPath ? `entró por ${visitor.landingPath}` : null,
        visitor.referrer ? `desde ${visitor.referrer}` : null,
    ].filter(Boolean).join(' · ');
}

interface VisitorListProps {
    visitors: OnlineVisitor[];
    loading: boolean;
    selectedConversationId: string | null;
    selectedGuestId: string | null;
    onSelect: (visitor: OnlineVisitor) => void;
}

export function VisitorList({
    visitors,
    loading,
    selectedConversationId,
    selectedGuestId,
    onSelect,
}: VisitorListProps) {
    if (loading && visitors.length === 0) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
        );
    }

    if (visitors.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2 px-6 text-center">
                <Users className="w-10 h-10" strokeWidth={1.2} />
                <p className="text-sm font-medium">Nadie navegando ahora</p>
                <p className="text-xs">Aparecen aquí apenas alguien entra a la tienda.</p>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-slate-100">
            {visitors.map(visitor => {
                const isOnline = visitor.status === 'online';
                const name = visitor.name || 'Visitante';
                const DeviceIcon = deviceIcon(visitor.device);
                const conversationId = visitor.conversationId;
                const isSelected = conversationId
                    ? conversationId === selectedConversationId
                    : visitor.guestId === selectedGuestId;

                return (
                    <li key={visitor.guestId}>
                        <button
                            onClick={() => onSelect(visitor)}
                            className={`w-full px-4 py-3 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-veci-primary/5 border-l-4 border-veci-primary' : ''
                                }`}
                        >
                            <div className="flex gap-3 w-full">
                                <div className="relative shrink-0">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white ${visitor.customerId
                                        ? 'bg-gradient-to-br from-indigo-500 to-purple-500'
                                        : 'bg-gradient-to-br from-slate-400 to-slate-500'
                                        }`}>
                                        {visitorInitials(visitor)}
                                    </div>
                                    <span
                                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-amber-400'
                                            }`}
                                        title={isOnline ? 'En línea' : 'Inactivo'}
                                    />
                                </div>

                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
                                        <span className="text-[10px] text-slate-400 shrink-0">
                                            {lastSeenLabel(visitor.lastSeenAt)}
                                        </span>
                                    </div>

                                    <div
                                        className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 min-w-0"
                                        title={detailTooltip(visitor)}
                                    >
                                        <span aria-hidden>{flagEmoji(visitor.country)}</span>
                                        <span className="truncate">{locationLabel(visitor)}</span>
                                        <span className="text-slate-300">·</span>
                                        <DeviceIcon className="w-3 h-3 shrink-0 text-slate-400" />
                                        <span className="truncate">{visitor.browser || visitor.os || 'Desconocido'}</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-1">
                                        <p
                                            className="text-[11px] text-slate-400 font-mono truncate"
                                            title={visitor.pageTitle || undefined}
                                        >
                                            {visitor.currentPath || '—'}
                                        </p>
                                        {conversationId ? (
                                            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-veci-primary">
                                                <MessageCircle className="w-3 h-3" />
                                                {visitor.unreadAgent > 0 ? visitor.unreadAgent : 'chat'}
                                            </span>
                                        ) : (
                                            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                <PenLine className="w-3 h-3" />
                                                {visitor.pageViews} pág · {timeOnSite(visitor.firstSeenAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

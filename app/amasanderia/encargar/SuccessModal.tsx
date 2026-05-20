"use client";

import Link from "next/link";
import { CheckCircle2, Cookie, Calendar, MapPin, Truck, Store } from "lucide-react";
import { formatCLP } from "@/lib/bakery-shared";

interface Props {
    publicCode: string;
    scheduledFor: string;
    method: "pickup" | "delivery";
    address: string | null;
    total: number;
    onClose: () => void;
}

export function SuccessModal({ publicCode, scheduledFor, method, address, total, onClose }: Props) {
    const dt = new Date(scheduledFor);
    const dateStr = dt.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = dt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header gradient */}
                <div className="relative bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 px-6 pt-8 pb-12 text-white text-center overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <h2 className="text-2xl font-extrabold mt-3">¡Encargo confirmado!</h2>
                        <p className="text-sm opacity-90 mt-1">Te avisaremos cuando esté listo.</p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 -mt-6 pb-6">

                    {/* Code card */}
                    <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 text-center shadow-md">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Código de encargo</p>
                        <p className="font-mono text-3xl font-black text-veci-dark mt-1 tracking-wider">{publicCode}</p>
                        <p className="text-[11px] text-slate-500 mt-1">Muéstralo al retirar / recibir</p>
                    </div>

                    {/* Details */}
                    <div className="mt-5 space-y-2.5 text-sm text-slate-700">
                        <div className="flex items-center gap-2.5">
                            <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="capitalize">{dateStr} · {timeStr}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            {method === "pickup" ? <Store className="w-4 h-4 text-amber-600 shrink-0" /> : <Truck className="w-4 h-4 text-amber-600 shrink-0" />}
                            <span>{method === "pickup" ? "Retiro en local" : "Delivery a domicilio"}</span>
                        </div>
                        {method === "delivery" && address && (
                            <div className="flex items-start gap-2.5">
                                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span className="text-slate-600">{address}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
                            <Cookie className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="font-bold">Total: {formatCLP(total)}</span>
                            <span className="text-[11px] text-slate-500">(pagas al recibir)</span>
                        </div>
                    </div>

                    {/* CTAs */}
                    <div className="mt-6 grid grid-cols-2 gap-2">
                        <Link
                            href="/cuenta/encargos"
                            onClick={onClose}
                            className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-gradient-to-r from-veci-primary to-rose-400 text-white font-bold text-sm shadow-md hover:shadow-lg transition"
                        >
                            Ver mis encargos
                        </Link>
                        <button
                            onClick={onClose}
                            className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition"
                        >
                            Seguir explorando
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Cookie, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useBakeryCart } from "./BakeryCartProvider";
import { calcBakeryItemSubtotal, formatCLP, formatKg, BAKERY_CATEGORY_LABELS } from "@/lib/bakery-shared";

interface Props {
    open: boolean;
    onClose: () => void;
}

export function BakeryCartDrawer({ open, onClose }: Props) {
    const { items, totalItems, totalUnits, subtotal, setQuantity, removeItem, clearCart } = useBakeryCart();

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (open) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    return (
        <>
            <div
                className={`fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                className={`fixed top-0 right-0 z-[71] h-full w-full sm:max-w-md bg-white shadow-2xl transition-transform duration-300 flex flex-col ${open ? "translate-x-0" : "translate-x-full"}`}
                role="dialog"
                aria-label="Tu encargo"
            >
                {/* Header */}
                <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center">
                            <Cookie className="w-5 h-5 text-amber-700" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 leading-tight">Tu encargo</h2>
                            <p className="text-[11px] text-slate-500">
                                {totalItems === 0 ? "Vacío" : `${totalItems} producto${totalItems === 1 ? "" : "s"} · ${totalUnits} unidad${totalUnits === 1 ? "" : "es"}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                {/* Items list */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-12">
                            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                                <Cookie className="w-8 h-8 text-amber-400" />
                            </div>
                            <h3 className="font-bold text-slate-700">Aún no agregas productos</h3>
                            <p className="text-sm text-slate-500 max-w-xs">Explora panes, sándwiches y más para empezar tu encargo.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {items.map((it) => {
                                const lineSubtotal = calcBakeryItemSubtotal(
                                    { pricingMode: it.pricingMode, price: it.unitPrice, gramsPerUnit: it.gramsPerUnit },
                                    it.quantity,
                                );
                                const totalGrams = it.pricingMode === "kg" && it.gramsPerUnit ? it.quantity * it.gramsPerUnit : null;
                                return (
                                    <li key={it.productId} className="bg-slate-50 rounded-2xl p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center overflow-hidden shrink-0">
                                                {it.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Cookie className="w-7 h-7 text-amber-700/50" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-800 leading-tight truncate">{it.name}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    {BAKERY_CATEGORY_LABELS[it.category]} ·{" "}
                                                    {it.pricingMode === "unit"
                                                        ? `${formatCLP(it.unitPrice)} c/u`
                                                        : `${formatCLP(it.unitPrice)}/kg`}
                                                </p>
                                                {totalGrams != null && (
                                                    <p className="text-[11px] text-amber-700 mt-0.5">
                                                        ≈ {formatKg(totalGrams)}
                                                    </p>
                                                )}
                                            </div>
                                            <button onClick={() => removeItem(it.productId)} className="text-slate-400 hover:text-rose-500 p-1" aria-label="Quitar">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <button
                                                onClick={() => setQuantity(it.productId, it.quantity - 1)}
                                                className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-700"
                                                aria-label="Restar"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-10 text-center text-sm font-bold text-slate-800">{it.quantity}</span>
                                            <button
                                                onClick={() => setQuantity(it.productId, it.quantity + 1)}
                                                className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-700"
                                                aria-label="Sumar"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                            <span className="ml-auto font-extrabold text-veci-dark">{formatCLP(lineSubtotal)}</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <footer className="border-t border-slate-100 px-5 py-4 space-y-3 bg-white">
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm text-slate-500">Subtotal</span>
                            <span className="text-xl font-extrabold text-veci-dark">{formatCLP(subtotal)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 text-center">
                            La fecha de retiro, método y total final se eligen en el siguiente paso.
                        </p>
                        <Link
                            href="/amasanderia/encargar"
                            onClick={onClose}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-veci-primary to-rose-400 text-white font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition"
                        >
                            <ShoppingBag className="w-5 h-5" />
                            Continuar al encargo
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <button
                            onClick={() => { if (confirm("¿Vaciar el encargo?")) clearCart(); }}
                            className="w-full text-xs text-slate-500 hover:text-rose-500 py-1"
                        >
                            Vaciar
                        </button>
                    </footer>
                )}
            </aside>
        </>
    );
}

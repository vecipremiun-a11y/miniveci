'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Minus, Package, Plus, ShoppingBag, ShoppingCart, Trash2, X } from 'lucide-react';
import { useCart, isWeightUnit, hasEquiv, getTieredPrice } from './CartProvider';

interface CartDrawerProps {
    open: boolean;
    onClose: () => void;
}

const PLACEHOLDER = '/placeholder-product.svg';

const fmtCLP = (value: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export function CartDrawer({ open, onClose }: CartDrawerProps) {
    const { items, totalItems, subtotal, updateQuantity, removeItem, clearCart } = useCart();
    const [hasMounted, setHasMounted] = useState(false);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const prevItemsRef = useRef<Map<string, number>>(new Map());

    useEffect(() => { setHasMounted(true); }, []);

    // Highlight items whose quantity just changed
    useEffect(() => {
        if (!hasMounted) return;
        const prev = prevItemsRef.current;
        let changedId: string | null = null;
        for (const item of items) {
            const before = prev.get(item.id);
            if (before === undefined || before !== item.quantity) {
                changedId = item.id;
                break;
            }
        }
        prevItemsRef.current = new Map(items.map((i) => [i.id, i.quantity]));
        if (changedId) {
            setHighlightedId(changedId);
            const t = setTimeout(() => setHighlightedId(null), 700);
            return () => clearTimeout(t);
        }
    }, [items, hasMounted]);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Compute total savings from price tiers
    const savings = useMemo(() => {
        return items.reduce((acc, item) => {
            const equiv = hasEquiv(item);
            const baseLine = equiv
                ? Math.round(item.price * item.equivWeight! * item.quantity)
                : item.price * item.quantity;
            const effective = getTieredPrice(item.price, item.priceTiers, item.quantity);
            const effLine = equiv
                ? Math.round(effective * item.equivWeight! * item.quantity)
                : effective * item.quantity;
            return acc + Math.max(0, baseLine - effLine);
        }, 0);
    }, [items]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <aside
                className={`fixed top-0 right-0 z-[70] h-full w-full max-w-md bg-gradient-to-b from-white via-white to-slate-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
                role="dialog"
                aria-label="Carrito de compras"
            >
                {/* Header — gradient */}
                <div className="relative px-6 py-5 bg-gradient-to-br from-veci-primary via-rose-400 to-fuchsia-400 text-white overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute -bottom-12 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold tracking-tight">Mi Carrito</h2>
                                <p className="text-xs font-medium text-white/85">
                                    {hasMounted && totalItems > 0
                                        ? `${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`
                                        : 'Sin productos'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors"
                            aria-label="Cerrar carrito"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {!hasMounted || items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-4 pb-12">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center ring-1 ring-slate-200">
                                <ShoppingCart className="w-10 h-10 text-slate-300" strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-slate-800 font-extrabold text-lg">Tu carrito está vacío</p>
                                <p className="text-sm text-slate-500 mt-1 max-w-[18rem]">Agrega productos desde la tienda para empezar a comprar.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-veci-dark text-white text-sm font-bold hover:bg-veci-dark/90 transition-colors"
                            >
                                <Package className="w-4 h-4" />
                                Ver productos
                            </button>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {items.map((item) => {
                                const equiv = hasEquiv(item);
                                const isWeight = !equiv && isWeightUnit(item.unit);
                                const isKgDirect = !equiv && item.id.endsWith('__kg');
                                const stepVal = equiv ? 1 : (isWeight || isKgDirect ? 0.5 : 1);
                                const minQty = equiv ? 1 : (isWeight || isKgDirect ? 0.5 : 1);
                                const effective = getTieredPrice(item.price, item.priceTiers, item.quantity);
                                const lineTotal = equiv
                                    ? Math.round(effective * item.equivWeight! * item.quantity)
                                    : effective * item.quantity;
                                const baseLine = equiv
                                    ? Math.round(item.price * item.equivWeight! * item.quantity)
                                    : item.price * item.quantity;
                                const hasDiscount = lineTotal < baseLine;
                                const unitLabel = equiv ? (item.equivLabel || 'und') : (isWeight || isKgDirect ? 'kg' : 'und');
                                const qtyDisplay = (isWeight || isKgDirect) ? item.quantity.toFixed(1) : item.quantity;
                                const isHighlighted = highlightedId === item.id;

                                return (
                                    <li
                                        key={item.id}
                                        className={`group flex gap-3 p-3 rounded-2xl bg-white border-2 transition-all duration-300 ${isHighlighted ? 'border-veci-primary shadow-md shadow-veci-primary/20 scale-[1.01]' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="relative w-20 h-20 shrink-0 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden flex items-center justify-center ring-1 ring-slate-200/50">
                                            <img
                                                src={item.image || PLACEHOLDER}
                                                alt={item.name}
                                                className="w-full h-full object-contain"
                                            />
                                            {hasDiscount && (
                                                <span className="absolute top-1 left-1 text-[9px] font-extrabold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                                                    OFERTA
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col">
                                            <div className="flex items-start justify-between gap-2">
                                                <p
                                                    className="text-sm font-bold text-slate-800 leading-snug line-clamp-2"
                                                    title={item.name}
                                                >
                                                    {item.name}
                                                </p>
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="w-7 h-7 -mt-0.5 -mr-0.5 flex items-center justify-center rounded-full text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                                                    aria-label={`Eliminar ${item.name}`}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                                                {fmtCLP(effective)} / {unitLabel}
                                                {equiv && <span className="ml-1">· {item.equivWeight} kg</span>}
                                            </p>

                                            <div className="flex items-center justify-between mt-auto pt-2">
                                                <div className="inline-flex items-center bg-slate-50 rounded-full p-0.5 ring-1 ring-slate-200">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, Math.round((item.quantity - stepVal) * 100) / 100)}
                                                        disabled={item.quantity <= minQty}
                                                        className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                        aria-label="Disminuir cantidad"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="text-xs font-extrabold text-slate-700 min-w-[2rem] text-center tabular-nums px-1">
                                                        {qtyDisplay}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, Math.round((item.quantity + stepVal) * 100) / 100)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm transition-all"
                                                        aria-label="Aumentar cantidad"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <div className="text-right">
                                                    {hasDiscount && (
                                                        <p className="text-[10px] text-slate-400 line-through font-medium tabular-nums">
                                                            {fmtCLP(baseLine)}
                                                        </p>
                                                    )}
                                                    <p className={`text-sm font-extrabold tabular-nums ${hasDiscount ? 'text-red-600' : 'text-slate-800'}`}>
                                                        {fmtCLP(lineTotal)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                {hasMounted && items.length > 0 && (
                    <div className="border-t border-slate-200 bg-white px-5 py-4 space-y-3">
                        {savings > 0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Ahorro por descuentos
                                </span>
                                <span className="font-extrabold text-emerald-600 tabular-nums">
                                    −{fmtCLP(savings)}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Subtotal</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Envío calculado al pagar</p>
                            </div>
                            <span className="text-2xl font-extrabold text-veci-dark tabular-nums">{fmtCLP(subtotal)}</span>
                        </div>

                        <Link
                            href="/carrito"
                            onClick={onClose}
                            className="group relative w-full py-3.5 rounded-2xl font-extrabold text-center flex items-center justify-center gap-2 bg-gradient-to-r from-veci-primary to-fuchsia-400 text-white shadow-lg shadow-veci-primary/30 hover:shadow-xl hover:shadow-veci-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all overflow-hidden"
                        >
                            <span>Ir a pagar</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </Link>

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <button
                                onClick={onClose}
                                className="flex-1 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors py-1"
                            >
                                Seguir comprando
                            </button>
                            <button
                                onClick={() => { if (confirm('¿Vaciar el carrito?')) clearCart(); }}
                                className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors py-1"
                            >
                                Vaciar carrito
                            </button>
                        </div>
                    </div>
                )}
            </aside>
        </>
    );
}

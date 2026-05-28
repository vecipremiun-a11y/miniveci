"use client";

import { useMemo, useState } from "react";
import { Clock, Cookie, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { BakeryCategory } from "@/lib/validations/bakery";
import { BAKERY_CATEGORY_LABELS, calcBakeryItemSubtotal, formatCLP, formatKg, formatLeadTime } from "@/lib/bakery-shared";
import { useBakeryCart } from "@/components/bakery-cart/BakeryCartProvider";
import { PriceDisplay } from "./PriceDisplay";

export interface BakeryProductInput {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    category: BakeryCategory;
    pricingMode: "unit" | "kg";
    price: number;
    gramsPerUnit: number | null;
    leadTimeHours?: number | null;
    allowsNotes: boolean;
}

const CATEGORY_GRADIENT: Record<BakeryCategory, string> = {
    pan: "from-amber-200 via-amber-100 to-orange-100",
    sandwich: "from-rose-100 via-pink-100 to-amber-100",
    hamburguesa: "from-orange-200 via-amber-100 to-yellow-100",
    canape: "from-violet-100 via-purple-100 to-rose-100",
    dulce: "from-pink-100 via-rose-100 to-amber-100",
};

const CATEGORY_BADGE: Record<BakeryCategory, string> = {
    pan: "bg-amber-100 text-amber-800 border-amber-200",
    sandwich: "bg-rose-100 text-rose-700 border-rose-200",
    hamburguesa: "bg-orange-100 text-orange-700 border-orange-200",
    canape: "bg-violet-100 text-violet-700 border-violet-200",
    dulce: "bg-pink-100 text-pink-700 border-pink-200",
};

export function BakeryProductCard({ product, defaultLeadHours = 0 }: { product: BakeryProductInput; defaultLeadHours?: number }) {
    const [qty, setQty] = useState(1);
    const { addItem } = useBakeryCart();

    // Anticipación efectiva del producto: su propio leadTimeHours si lo tiene, o el general.
    const productLead = product.leadTimeHours ?? 0;
    const effectiveLead = Math.max(defaultLeadHours, productLead);
    const isException = productLead > defaultLeadHours; // este producto necesita más que el general

    const subtotal = useMemo(
        () => calcBakeryItemSubtotal(
            { pricingMode: product.pricingMode, price: product.price, gramsPerUnit: product.gramsPerUnit },
            qty,
        ),
        [product, qty],
    );

    const totalGrams = product.pricingMode === "kg" && product.gramsPerUnit ? qty * product.gramsPerUnit : null;

    const handleAdd = () => {
        addItem(
            {
                productId: product.id,
                name: product.name,
                description: product.description,
                imageUrl: product.imageUrl,
                category: product.category,
                pricingMode: product.pricingMode,
                unitPrice: product.price,
                gramsPerUnit: product.gramsPerUnit,
                leadTimeHours: product.leadTimeHours ?? null,
                allowsNotes: product.allowsNotes,
            },
            qty,
        );
        toast.success(`${qty} × ${product.name}`, { description: `Agregado al encargo · ${formatCLP(subtotal)}` });
        setQty(1);
    };

    return (
        <article className="group bg-white/60 backdrop-blur-md border border-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col">

            {/* Image / fallback */}
            <div className={`relative aspect-[4/3] bg-gradient-to-br ${CATEGORY_GRADIENT[product.category]} overflow-hidden`}>
                {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Cookie className="w-16 h-16 text-amber-700/40 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                )}
                <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${CATEGORY_BADGE[product.category]}`}>
                    {BAKERY_CATEGORY_LABELS[product.category]}
                </span>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col p-4 sm:p-5">
                <h3 className="font-bold text-slate-800 text-base sm:text-lg leading-tight">{product.name}</h3>
                {product.description && (
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 line-clamp-2 min-h-[2.5em]">{product.description}</p>
                )}

                {/* Badge de tiempo de preparación */}
                {effectiveLead > 0 && (
                    <div
                        className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border self-start ${
                            isException
                                ? "bg-orange-100 text-orange-800 border-orange-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                        title={isException ? "Este producto requiere más anticipación que el resto" : "Tiempo mínimo de preparación"}
                    >
                        <Clock className="w-3 h-3" />
                        Pedir con {formatLeadTime(effectiveLead)} de anticipación
                    </div>
                )}

                <div className="mt-3">
                    <PriceDisplay
                        pricingMode={product.pricingMode}
                        price={product.price}
                        gramsPerUnit={product.gramsPerUnit}
                    />
                </div>

                {/* Quantity selector */}
                <div className="mt-auto pt-4">
                    <div className="flex items-center gap-2 mb-3">
                        <button
                            type="button"
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition disabled:opacity-40"
                            disabled={qty <= 1}
                            aria-label="Restar"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={500}
                            value={qty}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (Number.isFinite(v)) setQty(Math.min(500, Math.max(1, v)));
                            }}
                            className="w-14 h-9 rounded-full bg-white border border-slate-200 text-center font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-veci-primary/40"
                            aria-label="Cantidad de unidades"
                        />
                        <button
                            type="button"
                            onClick={() => setQty((q) => Math.min(500, q + 1))}
                            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                            aria-label="Sumar"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-slate-500 ml-auto">unidad{qty === 1 ? "" : "es"}</span>
                    </div>

                    {/* Live subtotal preview */}
                    <div className="bg-slate-50 rounded-xl px-3 py-2 mb-3 text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                        {product.pricingMode === "unit" ? (
                            <>
                                {qty} × {formatCLP(product.price)} ={" "}
                                <strong className="text-veci-dark text-sm">{formatCLP(subtotal)}</strong>
                            </>
                        ) : (
                            <>
                                {qty} × {product.gramsPerUnit}g = {totalGrams != null ? formatKg(totalGrams) : "—"} ·{" "}
                                <strong className="text-veci-dark text-sm">{formatCLP(subtotal)}</strong>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleAdd}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-veci-primary to-rose-400 text-white font-bold text-sm shadow-md shadow-veci-primary/25 hover:shadow-lg active:scale-[0.98] transition"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Agregar al encargo
                    </button>
                </div>
            </div>
        </article>
    );
}

"use client";

import { formatCLP } from "@/lib/bakery-shared";

interface Props {
    pricingMode: "unit" | "kg";
    price: number;
    gramsPerUnit: number | null;
    className?: string;
}

/**
 * Muestra el precio "principal" según pricingMode:
 *  - unit: "$3.500 c/u"
 *  - kg:   "$2.500/kg"  + tooltip-like con "~110g por unidad ≈ $275 c/u"
 */
export function PriceDisplay({ pricingMode, price, gramsPerUnit, className }: Props) {
    if (pricingMode === "unit") {
        return (
            <div className={className}>
                <span className="text-xl font-extrabold text-veci-dark">{formatCLP(price)}</span>
                <span className="text-xs text-slate-500 ml-1">c/u</span>
            </div>
        );
    }

    const perUnitApprox = gramsPerUnit ? Math.round((gramsPerUnit / 1000) * price) : null;

    return (
        <div className={className}>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-veci-dark">{formatCLP(price)}</span>
                <span className="text-xs text-slate-500">/kg</span>
            </div>
            {gramsPerUnit && perUnitApprox != null && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                    ~{gramsPerUnit}g por unidad · ≈ {formatCLP(perUnitApprox)} c/u
                </p>
            )}
        </div>
    );
}

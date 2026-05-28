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
 *  - kg:   "$2.500/kg"
 *
 * El detalle por unidad (gramaje + precio aprox.) se muestra en el preview
 * de subtotal vivo del card según la cantidad elegida, así no se duplica.
 */
export function PriceDisplay({ pricingMode, price, className }: Props) {
    if (pricingMode === "unit") {
        return (
            <div className={className}>
                <span className="text-xl font-extrabold text-veci-dark">{formatCLP(price)}</span>
                <span className="text-xs text-slate-500 ml-1">c/u</span>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-veci-dark">{formatCLP(price)}</span>
                <span className="text-xs text-slate-500">/kg</span>
            </div>
        </div>
    );
}

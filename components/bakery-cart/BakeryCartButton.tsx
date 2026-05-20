"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { useBakeryCart } from "./BakeryCartProvider";
import { BakeryCartDrawer } from "./BakeryCartDrawer";
import { formatCLP } from "@/lib/bakery-shared";

export function BakeryCartButton() {
    const { totalUnits, subtotal, ready } = useBakeryCart();
    const [open, setOpen] = useState(false);
    const [pulse, setPulse] = useState(false);
    const [prevUnits, setPrevUnits] = useState(0);

    useEffect(() => {
        if (!ready) return;
        if (totalUnits !== prevUnits) {
            if (totalUnits > prevUnits) {
                setPulse(true);
                const t = setTimeout(() => setPulse(false), 500);
                setPrevUnits(totalUnits);
                return () => clearTimeout(t);
            }
            setPrevUnits(totalUnits);
        }
    }, [totalUnits, ready, prevUnits]);

    if (!ready || totalUnits === 0) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50 inline-flex items-center gap-3 pl-3 pr-5 py-3 rounded-full bg-gradient-to-r from-veci-primary to-rose-400 text-white shadow-2xl shadow-veci-primary/40 hover:shadow-3xl hover:scale-[1.03] active:scale-[0.97] transition ${pulse ? "animate-bounce" : ""}`}
                aria-label="Ver mi encargo"
            >
                <span className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Cookie className="w-5 h-5" />
                    <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1.5 rounded-full bg-white text-veci-primary text-[11px] font-extrabold flex items-center justify-center shadow">
                        {totalUnits}
                    </span>
                </span>
                <span className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] uppercase tracking-wider opacity-90 font-semibold">Tu encargo</span>
                    <span className="text-sm font-extrabold">{formatCLP(subtotal)}</span>
                </span>
            </button>
            <BakeryCartDrawer open={open} onClose={() => setOpen(false)} />
        </>
    );
}

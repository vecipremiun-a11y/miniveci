"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { BakeryCategory } from "@/lib/validations/bakery";
import { calcBakeryItemSubtotal } from "@/lib/bakery-shared";

export interface BakeryCartItem {
    productId: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    category: BakeryCategory;
    pricingMode: "unit" | "kg";
    unitPrice: number;
    gramsPerUnit: number | null;
    leadTimeHours?: number | null; // anticipación propia del producto (horas); null = usa el general
    quantity: number;
    notes: string | null;
    allowsNotes: boolean;
}

interface BakeryCartContextValue {
    items: BakeryCartItem[];
    totalItems: number;
    totalUnits: number;
    subtotal: number;
    addItem: (item: Omit<BakeryCartItem, "quantity" | "notes">, quantity: number) => void;
    setQuantity: (productId: string, quantity: number) => void;
    setNotes: (productId: string, notes: string | null) => void;
    removeItem: (productId: string) => void;
    clearCart: () => void;
    ready: boolean;
}

const BakeryCartContext = createContext<BakeryCartContextValue | null>(null);
const STORAGE_KEY = "miniveci_bakery_cart";
const SHAPE_VERSION = 1;

interface StoredCart {
    v: number;
    items: BakeryCartItem[];
}

export function BakeryCartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<BakeryCartItem[]>([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as StoredCart;
                if (parsed?.v === SHAPE_VERSION && Array.isArray(parsed.items)) {
                    setItems(parsed.items.filter((it) => it?.productId && it.quantity > 0));
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
        setReady(true);
    }, []);

    useEffect(() => {
        if (!ready) return;
        const payload: StoredCart = { v: SHAPE_VERSION, items };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, [items, ready]);

    const addItem: BakeryCartContextValue["addItem"] = (item, quantity) => {
        const qty = Math.max(1, Math.floor(quantity));
        setItems((prev) => {
            const existing = prev.find((p) => p.productId === item.productId);
            if (existing) {
                return prev.map((p) =>
                    p.productId === item.productId ? { ...p, quantity: p.quantity + qty } : p,
                );
            }
            return [...prev, { ...item, quantity: qty, notes: null }];
        });
    };

    const setQuantity: BakeryCartContextValue["setQuantity"] = (productId, quantity) => {
        const qty = Math.floor(quantity);
        if (qty <= 0) {
            setItems((prev) => prev.filter((p) => p.productId !== productId));
            return;
        }
        setItems((prev) => prev.map((p) => (p.productId === productId ? { ...p, quantity: qty } : p)));
    };

    const setNotes: BakeryCartContextValue["setNotes"] = (productId, notes) => {
        const clean = notes && notes.trim().length > 0 ? notes.trim().slice(0, 280) : null;
        setItems((prev) => prev.map((p) => (p.productId === productId ? { ...p, notes: clean } : p)));
    };

    const removeItem: BakeryCartContextValue["removeItem"] = (productId) => {
        setItems((prev) => prev.filter((p) => p.productId !== productId));
    };

    const clearCart = () => setItems([]);

    const value = useMemo<BakeryCartContextValue>(() => {
        const totalItems = items.length;
        const totalUnits = items.reduce((s, it) => s + it.quantity, 0);
        const subtotal = items.reduce(
            (s, it) =>
                s + calcBakeryItemSubtotal(
                    { pricingMode: it.pricingMode, price: it.unitPrice, gramsPerUnit: it.gramsPerUnit },
                    it.quantity,
                ),
            0,
        );
        return { items, totalItems, totalUnits, subtotal, addItem, setQuantity, setNotes, removeItem, clearCart, ready };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, ready]);

    return <BakeryCartContext.Provider value={value}>{children}</BakeryCartContext.Provider>;
}

export function useBakeryCart() {
    const ctx = useContext(BakeryCartContext);
    if (!ctx) throw new Error("useBakeryCart debe usarse dentro de BakeryCartProvider");
    return ctx;
}

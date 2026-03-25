'use client';

import { motion } from 'framer-motion';
import { Plus, Minus, Percent, Tag, Zap } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useCart, isWeightUnit, hasEquiv, getTieredPrice } from '@/components/cart/CartProvider';
import type { PriceTier } from '@/components/cart/CartProvider';
import { useRouter } from 'next/navigation';

const PLACEHOLDER_IMAGE = '/placeholder-product.svg';

interface ProductCardProps {
    id: string;
    name: string;
    price: number;
    offerPrice?: number | null;
    isOffer?: boolean;
    stock: number;
    unit?: string;
    equivLabel?: string | null;
    equivWeight?: number | null;
    image?: string | null;
    isPopular?: boolean;
    slug?: string;
    priceTiers?: PriceTier[];
}

export function ProductCard({ id, name, price, offerPrice, isOffer, stock, unit, equivLabel, equivWeight, image, isPopular, slug, priceTiers }: ProductCardProps) {
    const { addItem } = useCart();
    const router = useRouter();
    const equiv = hasEquiv({ equivLabel, equivWeight });
    const [buyMode, setBuyMode] = useState<'unit' | 'kg'>('unit');
    const kgMode = equiv && buyMode === 'kg';
    const isWeight = !equiv && isWeightUnit(unit);
    const step = kgMode ? 0.5 : (equiv ? 1 : (isWeight ? 0.1 : 1));
    const minQty = kgMode ? 0.5 : (equiv ? 1 : (isWeight ? 0.1 : 1));
    const [quantity, setQuantity] = useState(minQty);
    const imageSrc = image || PLACEHOLDER_IMAGE;

    const hasOffer = Boolean(isOffer && offerPrice && offerPrice < price);
    const rawPrice = hasOffer ? offerPrice! : price;
    const tieredPrice = getTieredPrice(rawPrice, priceTiers, quantity);
    const displayPrice = equiv ? Math.round(tieredPrice * equivWeight!) : tieredPrice;
    const discountPercent = hasOffer ? Math.round(((price - offerPrice!) / price) * 100) : 0;

    const availableUnits = equiv ? Math.floor(stock / equivWeight!) : stock;
    const maxQty = kgMode ? stock : availableUnits;
    const outOfStock = stock <= 0;
    const equivUnitLabel = equivLabel && !/^\d+$/.test(equivLabel.trim()) ? equivLabel : 'und';

    const handleBuyModeChange = (mode: 'unit' | 'kg') => {
        if (mode === buyMode) return;
        setBuyMode(mode);
        setQuantity(mode === 'kg' ? 0.5 : 1);
    };

    const formattedPrice = useMemo(() =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(displayPrice),
        [displayPrice]
    );
    const formattedOriginal = useMemo(() => {
        if (!hasOffer) return '';
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
    }, [hasOffer, price]);
    const formattedKgPrice = useMemo(() =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(tieredPrice),
        [tieredPrice]
    );
    const cardSubtotal = useMemo(() => {
        const total = kgMode
            ? Math.round(quantity * tieredPrice)
            : equiv ? quantity * displayPrice : Math.round(quantity * tieredPrice);
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(total);
    }, [equiv, kgMode, quantity, displayPrice, tieredPrice]);
    // Stock label always shows real kg for equiv products
    const stockLabel = outOfStock ? 'Sin stock' : (isWeightUnit(unit) ? `${stock} ${(unit ?? 'Kg').toUpperCase()}` : `${stock} UND`);

    const handleAdd = () => {
        if (kgMode) {
            addItem({ id: `${id}__kg`, name, price: rawPrice, image: imageSrc, slug, unit, priceTiers }, quantity);
        } else {
            addItem({ id, name, price: rawPrice, image: imageSrc, slug, unit, equivLabel, equivWeight, priceTiers }, quantity);
        }
        setQuantity(minQty);
    };

    const goToDetail = () => {
        if (!slug) return;
        router.push(`/productos/${slug}`);
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            onClick={goToDetail}
            className="glass-card p-4 rounded-[2rem] flex flex-col items-center relative group cursor-pointer"
        >
            {/* Badges */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5">
                {hasOffer && (
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-md shadow-red-200/50 animate-pulse">
                        <Percent className="w-3 h-3" />
                        -{discountPercent}%
                    </span>
                )}
                {isPopular && (
                    <span className="bg-orange-100 text-orange-500 text-xs font-bold px-3 py-1 rounded-full">
                        Popular
                    </span>
                )}
            </div>

            {/* Offer ribbon */}
            {hasOffer && (
                <div className="absolute top-0 left-4 z-20">
                    <div className="bg-gradient-to-b from-red-500 to-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-1.5 rounded-b-lg shadow-md">
                        Oferta
                    </div>
                </div>
            )}

            {/* Image Area */}
            <div className="w-full h-40 flex items-center justify-center relative mb-4 overflow-hidden rounded-2xl bg-white">
                <img
                    src={imageSrc}
                    alt={name}
                    className="relative z-10 max-h-full max-w-full object-contain transform group-hover:scale-110 transition-transform duration-300"
                />
            </div>

            {/* Content */}
            <div className="w-full space-y-2">
                <h3 className="font-bold text-slate-800 text-lg truncate">{name}</h3>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                        {equiv ? (
                            <>
                                <p className={`font-extrabold text-xl ${hasOffer ? 'text-red-600' : 'text-veci-dark'}`}>
                                    {formattedKgPrice}<span className="text-sm font-bold text-slate-400">/kg</span>
                                </p>
                                {hasOffer && (
                                    <p className="text-sm text-slate-400 line-through font-medium">{formattedOriginal}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <p className={`font-extrabold text-xl ${hasOffer ? 'text-red-600' : 'text-veci-dark'}`}>
                                    {formattedPrice}
                                </p>
                                {hasOffer && (
                                    <p className="text-sm text-slate-400 line-through font-medium">{formattedOriginal}</p>
                                )}
                            </>
                        )}
                    </div>
                    <div className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${outOfStock ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100'}`}>
                        {stockLabel}
                    </div>
                </div>

                {/* Mini Price Tiers */}
                {priceTiers && priceTiers.length > 0 && (
                    <div className="rounded-xl bg-gradient-to-r from-violet-50 to-fuchsia-50 border-2 border-purple-300 shadow-sm shadow-purple-100 p-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Tag className="h-3 w-3 text-purple-500" />
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Compra más, paga menos</span>
                        </div>
                        {priceTiers.map((tier, idx) => {
                            const fmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
                            const isActive = quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty);
                            const isLastTier = tier.maxQty === null;
                            const colors = ['bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-violet-400'];
                            return (
                                <div
                                    key={idx}
                                    className={`flex items-center justify-between py-1 px-2 rounded-lg text-[11px] transition-all ${
                                        isActive
                                            ? 'bg-purple-100 ring-1 ring-purple-300 font-extrabold text-purple-800'
                                            : 'text-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${colors[idx % colors.length]} ${isActive ? 'ring-1 ring-offset-1 ring-purple-400' : ''}`} />
                                        <span>{isLastTier ? `${tier.minQty}+` : `${tier.minQty}-${tier.maxQty}`} und</span>
                                        {isLastTier && (
                                            <Zap className="h-2.5 w-2.5 text-amber-500" />
                                        )}
                                    </div>
                                    <span className={`font-bold ${isActive ? 'text-purple-700' : 'text-slate-700'}`}>
                                        {fmt.format(tier.price)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                {equiv && !outOfStock && (
                    <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-amber-700">c/u ≈ {formattedPrice} ({equivWeight} kg)</p>
                        <p className="text-xs font-semibold text-emerald-600">~{availableUnits} {equivUnitLabel} disponibles</p>
                        {/* Compact buy mode toggle */}
                        <div className="flex rounded-lg bg-slate-100 p-0.5" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleBuyModeChange('unit'); }}
                                className={`flex-1 text-[11px] font-bold py-1 rounded-md transition-all ${
                                    buyMode === 'unit' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Unidad
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleBuyModeChange('kg'); }}
                                className={`flex-1 text-[11px] font-bold py-1 rounded-md transition-all ${
                                    buyMode === 'kg' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Kilogramo
                            </button>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                    {/* Quantity Selector */}
                    <div className="flex items-center justify-between bg-white/60 rounded-full px-2 py-1.5 border border-white/50 shadow-sm">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setQuantity((q) => Math.max(minQty, Math.round((q - step) * 100) / 100));
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-bold text-slate-700 min-w-[2rem] text-center select-none">{(kgMode || isWeight) ? quantity.toFixed(1) : quantity}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setQuantity((q) => Math.min(maxQty, Math.round((q + step) * 100) / 100));
                            }}
                            disabled={quantity >= maxQty}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAdd();
                        }}
                        disabled={outOfStock}
                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-sm font-bold py-2.5 rounded-full shadow-lg hover:shadow-xl hover:shadow-purple-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {outOfStock ? 'Sin stock' : (
                            <>
                                <span>Agregar</span>
                                <span className="opacity-75">·</span>
                                <span>{cardSubtotal}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

        </motion.div>
    );
}

'use client';

import { motion } from 'framer-motion';
import { Plus, Minus, TrendingDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useCart, isWeightUnit, hasEquiv, getEffectivePrice, getTieredPrice } from '@/components/cart/CartProvider';
import type { PriceTier } from '@/components/cart/CartProvider';
import { useRouter } from 'next/navigation';

const PLACEHOLDER_IMAGE = '/placeholder-product-feria.svg';

const fmtCLP = (value: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

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
    /** Precio de socio. Solo llega si quien mira tiene la membresía activa. */
    subscriptionPrice?: number | null;
}

export function ProductCard({ id, name, price, offerPrice, isOffer, stock, unit, equivLabel, equivWeight, image, isPopular, slug, priceTiers, subscriptionPrice }: ProductCardProps) {
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
    const tieredPrice = getEffectivePrice(rawPrice, priceTiers, quantity, subscriptionPrice);
    // Lo que pagaría sin la membresía, para mostrar el ahorro tachado.
    const regularPrice = getTieredPrice(rawPrice, priceTiers, quantity);
    const isSubscriberPrice = tieredPrice < regularPrice;
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

    const formattedPrice = useMemo(() => fmtCLP(displayPrice), [displayPrice]);
    const formattedOriginal = useMemo(() => hasOffer ? fmtCLP(price) : '', [hasOffer, price]);
    // Precio de lista tachado cuando manda el precio de socio (en equiv, por unidad).
    const formattedRegular = useMemo(
        () => isSubscriberPrice ? fmtCLP(equiv ? Math.round(regularPrice * equivWeight!) : regularPrice) : '',
        [isSubscriberPrice, equiv, regularPrice, equivWeight],
    );
    const formattedKgPrice = useMemo(() => fmtCLP(tieredPrice), [tieredPrice]);

    const subtotalValue = useMemo(() => (
        kgMode
            ? Math.round(quantity * tieredPrice)
            : equiv ? quantity * displayPrice : Math.round(quantity * tieredPrice)
    ), [equiv, kgMode, quantity, displayPrice, tieredPrice]);

    const cardSubtotal = useMemo(() => fmtCLP(subtotalValue), [subtotalValue]);

    // Lo que la escala le ahorra en esta compra frente al precio de lista
    const tierSavings = useMemo(() => {
        if (!priceTiers || priceTiers.length === 0) return 0;
        const baseUnit = equiv && !kgMode ? Math.round(rawPrice * equivWeight!) : rawPrice;
        return Math.max(0, Math.round(quantity * baseUnit) - subtotalValue);
    }, [priceTiers, equiv, kgMode, rawPrice, equivWeight, quantity, subtotalValue]);
    // Stock label always shows real kg for equiv products
    const stockLabel = outOfStock ? 'Sin stock' : (isWeightUnit(unit) ? `${stock} ${(unit ?? 'Kg').toUpperCase()}` : `${stock} UND`);
    const lowStock = !outOfStock && stock <= 5;

    const handleAdd = () => {
        if (kgMode) {
            addItem({ id: `${id}__kg`, name, price: rawPrice, image: imageSrc, slug, unit, priceTiers, subscriptionPrice }, quantity);
        } else {
            addItem({ id, name, price: rawPrice, image: imageSrc, slug, unit, equivLabel, equivWeight, priceTiers, subscriptionPrice }, quantity);
        }
        setQuantity(minQty);
    };

    const goToDetail = () => {
        if (!slug) return;
        router.push(`/productos/${slug}`);
    };

    return (
        <motion.div
            whileHover={{ y: -3 }}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onClick={goToDetail}
            className={`feria-card rounded-2xl flex flex-col overflow-hidden relative group cursor-pointer ${outOfStock ? 'opacity-70' : ''}`}
        >
            {/* Vitrina: imagen + estado */}
            <div className="relative aspect-square flex items-center justify-center bg-white border-b border-cerco-suave overflow-hidden">
                <img
                    src={imageSrc}
                    alt={name}
                    className="w-full h-full object-contain p-1.5 sm:p-2 transform group-hover:scale-[1.06] transition-transform duration-300"
                />

                <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1.5 pointer-events-none">
                    <div className="flex flex-col gap-1">
                        {hasOffer && (
                            <span className="bg-tomate text-white text-[10px] leading-tight font-extrabold uppercase tracking-wide px-2 py-[3px] rounded-full">
                                −{discountPercent}%
                            </span>
                        )}
                        {isPopular && !hasOffer && (
                            <span className="bg-choclo-suave text-choclo ring-1 ring-choclo text-[10px] leading-tight font-extrabold uppercase tracking-wide px-2 py-[3px] rounded-full">
                                Popular
                            </span>
                        )}
                    </div>
                    <span className={`shrink-0 bg-white text-[10px] leading-tight font-bold px-2 py-[3px] rounded-full ring-1 tabular-nums ${
                        outOfStock
                            ? 'text-tomate ring-tomate'
                            : lowStock
                                ? 'text-tomate ring-tomate/40'
                                : 'text-tinta ring-cerco'
                    }`}>
                        {lowStock && !outOfStock ? `Quedan ${stockLabel}` : stockLabel}
                    </span>
                </div>
            </div>

            {/* Cuerpo */}
            <div className="flex flex-col gap-2 p-2.5 sm:p-3 flex-1">
                <h3
                    className="font-semibold text-hoja text-xs sm:text-[13.5px] leading-snug line-clamp-2 min-h-[2.6em]"
                    title={name}
                >
                    {name}
                </h3>

                {/* Precio: lo primero que se lee */}
                <div className="flex items-baseline gap-1.5 flex-wrap">
                    {equiv ? (
                        <>
                            <p className={`font-extrabold text-lg sm:text-[22px] leading-none tracking-tight tabular-nums ${hasOffer ? 'text-tomate' : 'text-hoja'}`}>
                                {formattedKgPrice}<span className="text-[11px] font-bold text-tinta-clara">/kg</span>
                            </p>
                            {hasOffer && (
                                <p className="text-[11px] sm:text-xs text-tinta-clara line-through tabular-nums">{formattedOriginal}</p>
                            )}
                            {isSubscriberPrice && (
                                <p className="text-[11px] sm:text-xs text-tinta-clara line-through tabular-nums">{formattedRegular}</p>
                            )}
                            {isSubscriberPrice && (
                                <span className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-white bg-hoja rounded-full px-1.5 py-0.5 leading-none">
                                    Socio
                                </span>
                            )}
                        </>
                    ) : (
                        <>
                            <p className={`font-extrabold text-lg sm:text-[22px] leading-none tracking-tight tabular-nums ${hasOffer ? 'text-tomate' : 'text-hoja'}`}>
                                {formattedPrice}
                            </p>
                            {hasOffer && (
                                <p className="text-[11px] sm:text-xs text-tinta-clara line-through tabular-nums">{formattedOriginal}</p>
                            )}
                            {isSubscriberPrice && (
                                <p className="text-[11px] sm:text-xs text-tinta-clara line-through tabular-nums">{formattedRegular}</p>
                            )}
                            <span className="text-[11px] font-semibold text-tinta-clara">c/u</span>
                            {isSubscriberPrice && (
                                <span className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-white bg-hoja rounded-full px-1.5 py-0.5 leading-none">
                                    Socio
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Tramos por cantidad: se leen como boleta, no como aviso */}
                {priceTiers && priceTiers.length > 0 && (
                    <div className="rounded-xl bg-white border border-lechuga-viva p-1.5 space-y-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 px-0.5">
                            <TrendingDown className="w-3 h-3 text-tallo shrink-0" strokeWidth={2.5} />
                            <span className="text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-tallo leading-tight">
                                Lleva más, paga menos
                            </span>
                        </div>

                        {priceTiers.map((tier, idx) => {
                            const isActive = quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty);
                            const isLastTier = tier.maxQty === null;
                            return (
                                <div
                                    key={idx}
                                    className={`flex items-center justify-between gap-1.5 rounded-lg px-1.5 py-[3px] text-[11px] tabular-nums transition-colors ${
                                        isActive ? 'bg-lechuga text-hoja' : 'text-tinta'
                                    }`}
                                >
                                    <span className={isActive ? 'font-extrabold' : 'font-semibold'}>
                                        {isLastTier ? `${tier.minQty}+` : `${tier.minQty}–${tier.maxQty}`} und
                                    </span>
                                    <span className={isActive ? 'font-extrabold' : 'font-bold text-hoja'}>
                                        {fmtCLP(tier.price)}
                                    </span>
                                </div>
                            );
                        })}

                        {tierSavings > 0 && (
                            <p className="text-[10px] font-bold text-tallo text-center leading-tight pt-0.5">
                                Ahorras {fmtCLP(tierSavings)}
                            </p>
                        )}
                    </div>
                )}

                {equiv && !outOfStock && (
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-tinta">c/u ≈ {formattedPrice} ({equivWeight} kg)</p>
                        <p className="text-[11px] font-semibold text-tallo">~{availableUnits} {equivUnitLabel} disponibles</p>
                        {/* Modo de compra */}
                        <div className="flex rounded-full bg-papel-hondo p-0.5 border border-cerco" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleBuyModeChange('unit'); }}
                                className={`flex-1 text-[11px] font-bold py-1 rounded-full transition-all ${
                                    buyMode === 'unit' ? 'bg-white text-hoja shadow-sm' : 'text-tinta hover:text-hoja'
                                }`}
                            >
                                Unidad
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleBuyModeChange('kg'); }}
                                className={`flex-1 text-[11px] font-bold py-1 rounded-full transition-all ${
                                    buyMode === 'kg' ? 'bg-white text-hoja shadow-sm' : 'text-tinta hover:text-hoja'
                                }`}
                            >
                                Kilogramo
                            </button>
                        </div>
                    </div>
                )}

                {/* Acciones */}
                <div className="flex items-stretch gap-1.5 mt-auto pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center shrink-0 bg-papel rounded-full border border-cerco p-0.5">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setQuantity((q) => Math.max(minQty, Math.round((q - step) * 100) / 100));
                            }}
                            aria-label="Quitar uno"
                            className="w-6 h-6 flex items-center justify-center rounded-full text-tinta hover:bg-brote hover:text-tallo transition-colors"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[13px] font-bold text-hoja min-w-[1.6rem] text-center select-none tabular-nums">
                            {(kgMode || isWeight) ? quantity.toFixed(1) : quantity}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setQuantity((q) => Math.min(maxQty, Math.round((q + step) * 100) / 100));
                            }}
                            disabled={quantity >= maxQty}
                            aria-label="Agregar uno"
                            className="w-6 h-6 flex items-center justify-center rounded-full text-tinta hover:bg-brote hover:text-tallo transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAdd();
                        }}
                        disabled={outOfStock}
                        className="flex-1 min-w-0 bg-lechuga hover:bg-lechuga-viva active:scale-[0.97] text-hoja text-[12px] sm:text-[13px] font-extrabold py-1.5 rounded-full transition-all flex items-center justify-center gap-1 tabular-nums disabled:bg-papel-hondo disabled:text-tinta-clara disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                        {outOfStock ? 'Sin stock' : (
                            <>
                                <span>Agregar</span>
                                <span className="opacity-45">·</span>
                                <span>{cardSubtotal}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

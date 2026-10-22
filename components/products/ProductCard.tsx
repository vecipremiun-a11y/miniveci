'use client';

import { motion } from 'framer-motion';
import { Plus, Minus, TrendingDown } from 'lucide-react';
import { useEffect, useState, useMemo, type PointerEvent } from 'react';
import { useCart, isWeightUnit, hasEquiv, getEffectivePrice, getTieredPrice, getOfferCartCap } from '@/components/cart/CartProvider';
import type { PriceTier } from '@/components/cart/CartProvider';
import { COMERCIAL_VECI_BADGE, type StorePresentation } from '@/lib/store-product-types';
import { normalizePriceTiers, tierProgress } from '@/lib/product-price';
import { OfferCountdown } from '@/components/products/OfferEndsLabel';
import { useRouter } from 'next/navigation';

const PLACEHOLDER_IMAGE = '/placeholder-product-feria.svg';

const fmtCLP = (value: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

/** "12 und" o "3.5 kg": lo que queda en oferta, en la unidad del producto. */
export function formatOfferStock(offerStock: number, unit?: string | null): string {
    return isWeightUnit(unit)
        ? `${offerStock.toLocaleString('es-CL', { maximumFractionDigits: 3 })} ${(unit ?? 'kg').toLowerCase()}`
        : `${Math.floor(offerStock)} und`;
}

/**
 * Aviso bajo la escala: a qué precio pasa al agregar lo elegido, o cuánto le
 * falta en el carrito para el próximo tramo. null si no hay nada que decir.
 */
export function tierHintText(
    tiers: PriceTier[],
    progress: ReturnType<typeof tierProgress>,
    inCart: number,
    adding: number,
    byWeight = false,
): string | null {
    const qty = (q: number) => (byWeight ? `${q.toLocaleString('es-CL', { maximumFractionDigits: 2 })} kg` : `${q}`);
    if (progress.afterAdd > progress.current) {
        const price = fmtCLP(tiers[progress.afterAdd].price);
        return inCart > 0 ? `Con ${qty(adding)} más pasas a ${price} c/u` : `Llevando ${qty(adding)} pagas ${price} c/u`;
    }
    if (inCart <= 0) return null;
    if (!progress.next) return 'Ya tienes el mejor precio';
    return `Te ${progress.missing === 1 ? 'falta' : 'faltan'} ${qty(progress.missing)} para ${fmtCLP(progress.next.price)} c/u`;
}

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
    /** Todas las fotos del producto: con más de una, se van turnando al pasar el mouse. */
    images?: string[];
    isPopular?: boolean;
    slug?: string;
    priceTiers?: PriceTier[];
    /** Precio de socio. Solo llega si quien mira tiene la membresía activa. */
    subscriptionPrice?: number | null;
    badges?: string[] | null;
    /** Grupo de escala: suma cantidad con los otros productos del grupo. */
    tierGroup?: string | null;
    /** Fin programado de la oferta (ISO), para mostrar cuánto le queda. */
    offerEndsAt?: string | null;
    /** Oferta por stock: lo que queda a precio oferta (kg en los de peso). */
    offerStock?: number | null;
    /** Unidades de medida (Caja, Bandeja…). Se eligen en la ficha; acá solo se avisa. */
    presentations?: StorePresentation[];
}

/** Cada cuánto cambia la foto mientras el mouse está sobre la tarjeta. */
const HOVER_IMAGE_INTERVAL_MS = 1400;

export function ProductCard({ id, name, price, offerPrice, isOffer, stock, unit, equivLabel, equivWeight, image, images, isPopular, slug, priceTiers, subscriptionPrice, badges, tierGroup, offerEndsAt, offerStock, presentations }: ProductCardProps) {
    const hasVeciSeal = badges?.includes(COMERCIAL_VECI_BADGE) ?? false;
    const { addItem, getGroupQuantity, getLineQuantity } = useCart();
    const router = useRouter();
    const equiv = hasEquiv({ equivLabel, equivWeight });
    const [buyMode, setBuyMode] = useState<'unit' | 'kg'>('unit');
    const kgMode = equiv && buyMode === 'kg';
    const isWeight = !equiv && isWeightUnit(unit);
    const step = kgMode ? 0.5 : (equiv ? 1 : (isWeight ? 0.1 : 1));
    const minQty = kgMode ? 0.5 : (equiv ? 1 : (isWeight ? 0.1 : 1));
    const [quantity, setQuantity] = useState(minQty);
    const imageSrc = image || PLACEHOLDER_IMAGE;

    // Fotos de la vitrina: la principal primero y después las demás, sin repetir.
    const gallery = useMemo(
        () => Array.from(new Set([imageSrc, ...(images ?? []).filter(Boolean)])),
        [imageSrc, images],
    );
    // Con el mouse encima (no con el dedo) las fotos se turnan; al salir vuelve la principal.
    const [hovering, setHovering] = useState(false);
    const [activeImage, setActiveImage] = useState(0);
    const shownImage = activeImage < gallery.length ? activeImage : 0;

    useEffect(() => {
        if (!hovering || gallery.length < 2) return;
        const timer = window.setInterval(
            () => setActiveImage((i) => (i + 1) % gallery.length),
            HOVER_IMAGE_INTERVAL_MS,
        );
        return () => window.clearInterval(timer);
    }, [hovering, gallery.length]);

    const handlePointerEnter = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse' || gallery.length < 2) return;
        setHovering(true);
        setActiveImage(1);
    };
    const handlePointerLeave = () => {
        setHovering(false);
        setActiveImage(0);
    };

    // Escala: lo que ya hay en el carrito cuenta para el tramo (todo el grupo de
    // escala, o este mismo renglón si va solo, que es donde se suma al agregar).
    // El precio del botón es el que queda al agregar; el tramo marcado es el
    // que ya se alcanzó en el carrito.
    const groupable = Boolean(tierGroup) && !equiv && !isWeight;
    const inCart = groupable ? getGroupQuantity(tierGroup) : getLineQuantity(kgMode ? `${id}__kg` : id);
    const tierQty = inCart + quantity;
    const tiers = useMemo(() => normalizePriceTiers(priceTiers), [priceTiers]);
    const progress = tierProgress(tiers, inCart, quantity);

    const hasOffer = Boolean(isOffer && offerPrice && offerPrice < price);
    const rawPrice = hasOffer ? offerPrice! : price;
    const tieredPrice = getEffectivePrice(rawPrice, tiers, tierQty, subscriptionPrice);
    // Lo que pagaría sin la membresía, para mostrar el ahorro tachado.
    const regularPrice = getTieredPrice(rawPrice, tiers, tierQty);
    const isSubscriberPrice = tieredPrice < regularPrice;
    const displayPrice = equiv ? Math.round(tieredPrice * equivWeight!) : tieredPrice;
    const discountPercent = hasOffer ? Math.round(((price - offerPrice!) / price) * 100) : 0;

    // Oferta por stock: mientras dure, se muestra y se vende solo lo que queda en
    // oferta; al agotarse vuelve el precio normal con el stock real.
    const offerStockLeft = hasOffer ? offerStock ?? null : null;
    const shownStock = offerStockLeft !== null ? Math.min(stock, offerStockLeft) : stock;
    const availableUnits = equiv ? Math.floor(shownStock / equivWeight!) : shownStock;
    const offerCap = getOfferCartCap({ id: kgMode ? `${id}__kg` : id, unit, equivLabel: kgMode ? null : equivLabel, equivWeight: kgMode ? null : equivWeight, offerStock: offerStockLeft });
    const maxQty = Math.min(kgMode ? shownStock : availableUnits, offerCap ?? Infinity);
    const outOfStock = shownStock <= 0;
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
        if (tiers.length === 0) return 0;
        const baseUnit = equiv && !kgMode ? Math.round(rawPrice * equivWeight!) : rawPrice;
        return Math.max(0, Math.round(quantity * baseUnit) - subtotalValue);
    }, [tiers, equiv, kgMode, rawPrice, equivWeight, quantity, subtotalValue]);
    const tierHint = tierHintText(tiers, progress, inCart, quantity, kgMode || isWeight);
    // Stock label always shows real kg for equiv products
    const stockLabel = outOfStock ? 'Sin stock' : (isWeightUnit(unit) ? `${shownStock} ${(unit ?? 'Kg').toUpperCase()}` : `${shownStock} UND`);
    const lowStock = !outOfStock && shownStock <= 5;

    const handleAdd = () => {
        if (kgMode) {
            addItem({ id: `${id}__kg`, name, price: rawPrice, image: imageSrc, slug, unit, priceTiers: tiers, subscriptionPrice, offerStock: offerStockLeft }, quantity);
        } else {
            addItem({ id, name, price: rawPrice, image: imageSrc, slug, unit, equivLabel, equivWeight, priceTiers: tiers, subscriptionPrice, tierGroup, offerStock: offerStockLeft }, quantity);
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
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            className={`feria-card rounded-2xl flex flex-col overflow-hidden relative group cursor-pointer ${outOfStock ? 'opacity-70' : ''}`}
        >
            {/* Vitrina: imagen + estado */}
            <div className="relative aspect-square flex items-center justify-center bg-white border-b border-cerco-suave overflow-hidden">
                {gallery.map((src, index) => (
                    <img
                        key={src}
                        src={src}
                        alt={index === 0 ? name : ''}
                        aria-hidden={index === 0 ? undefined : true}
                        loading={index === 0 ? undefined : 'lazy'}
                        className={`w-full h-full object-contain p-1.5 sm:p-2 transform group-hover:scale-[1.06] transition-[transform,opacity] duration-300 ${
                            index === 0 ? '' : 'absolute inset-0'
                        } ${index === shownImage ? 'opacity-100' : 'opacity-0'}`}
                    />
                ))}

                {/* Puntitos: qué foto se está viendo, solo mientras se turnan */}
                {hovering && gallery.length > 1 && !(hasOffer && offerEndsAt) && (
                    <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 pointer-events-none">
                        {gallery.map((src, index) => (
                            <span
                                key={src}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    index === shownImage ? 'w-4 bg-hoja' : 'w-1.5 bg-tinta/25'
                                }`}
                            />
                        ))}
                    </div>
                )}

                <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1.5 pointer-events-none">
                    <div className="flex flex-col items-start gap-1">
                        {hasVeciSeal && (
                            <img
                                src="/sello-comercial-veci.png"
                                alt="Comercial Veci"
                                className="w-16 sm:w-20 h-auto drop-shadow-sm"
                            />
                        )}
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

                {/* Cuenta regresiva de la oferta, sobre la foto y del ancho de la tarjeta */}
                {hasOffer && offerEndsAt && <OfferCountdown endsAt={offerEndsAt} />}
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

                {offerStockLeft !== null && (
                    <p className="text-[11px] font-extrabold text-tomate leading-tight">
                        ¡Quedan {formatOfferStock(offerStockLeft, unit)} en oferta!
                    </p>
                )}

                {/* Unidades de medida: se eligen en la ficha (la tarjeta abre la ficha). */}
                {presentations && presentations.length > 0 && (
                    <p className="text-[11px] font-bold text-tallo leading-tight">
                        También por {presentations.map((p) => `${p.name.toLowerCase()} (${p.units})`).join(', ')}
                    </p>
                )}

                {/* Tramos por cantidad: se leen como boleta, no como aviso */}
                {tiers.length > 0 && (
                    <div className="rounded-xl bg-white border border-lechuga-viva p-1.5 space-y-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 px-0.5">
                            <TrendingDown className="w-3 h-3 text-tallo shrink-0" strokeWidth={2.5} />
                            <span className="text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-tallo leading-tight">
                                Lleva más, paga menos
                            </span>
                        </div>

                        {tiers.map((tier, idx) => {
                            // Se marca el tramo ya alcanzado en el carrito, no el que tendría al agregar.
                            const isActive = idx === progress.current;
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

                        {groupable && (
                            <p className="text-[10px] font-semibold text-tallo leading-tight px-0.5 pt-0.5">
                                Suma con otros “{tierGroup}”{inCart > 0 ? ` · llevas ${inCart}` : ''}
                            </p>
                        )}

                        {tierHint && (
                            <p className="text-[10px] font-bold text-hoja leading-tight px-0.5">
                                {tierHint}
                            </p>
                        )}

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

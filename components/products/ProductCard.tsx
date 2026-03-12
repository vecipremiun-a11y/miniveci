'use client';

import { motion } from 'framer-motion';
import { Plus, Minus, Percent } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useCart, isWeightUnit } from '@/components/cart/CartProvider';
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
    image?: string | null;
    isPopular?: boolean;
    slug?: string;
}

export function ProductCard({ id, name, price, offerPrice, isOffer, stock, unit, image, isPopular, slug }: ProductCardProps) {
    const { addItem } = useCart();
    const router = useRouter();
    const isWeight = isWeightUnit(unit);
    const step = isWeight ? 0.1 : 1;
    const minQty = isWeight ? 0.1 : 1;
    const [quantity, setQuantity] = useState(minQty);
    const imageSrc = image || PLACEHOLDER_IMAGE;

    const hasOffer = Boolean(isOffer && offerPrice && offerPrice < price);
    const displayPrice = hasOffer ? offerPrice! : price;
    const discountPercent = hasOffer ? Math.round(((price - offerPrice!) / price) * 100) : 0;

    const formattedPrice = useMemo(() =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(displayPrice),
        [displayPrice]
    );
    const formattedOriginal = useMemo(() =>
        hasOffer ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price) : '',
        [hasOffer, price]
    );
    const stockLabel = stock <= 0 ? 'Sin stock' : (isWeight ? `${stock} ${(unit ?? 'Kg').toUpperCase()}` : `${stock} UND`);
    const outOfStock = stock <= 0;

    const handleAdd = () => {
        addItem({ id, name, price: displayPrice, image: imageSrc, slug, unit }, quantity);
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
            <div className="w-full h-40 flex items-center justify-center relative mb-4 overflow-hidden rounded-2xl">
                {/* Glow effect behind image */}
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-200/50 to-pink-200/50 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                <img
                    src={imageSrc}
                    alt={name}
                    className="relative z-10 max-h-full max-w-full object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-300"
                />
            </div>

            {/* Content */}
            <div className="w-full space-y-2">
                <h3 className="font-bold text-slate-800 text-lg truncate">{name}</h3>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                        <p className={`font-extrabold text-xl ${hasOffer ? 'text-red-600' : 'text-veci-dark'}`}>{formattedPrice}</p>
                        {hasOffer && (
                            <p className="text-sm text-slate-400 line-through font-medium">{formattedOriginal}</p>
                        )}
                    </div>
                    <div className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${outOfStock ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100'}`}>
                        {stockLabel}
                    </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center gap-2 mt-4">

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-3 bg-white/60 rounded-full px-3 py-2 border border-white/50 shadow-sm">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setQuantity((q) => Math.max(minQty, Math.round((q - step) * 100) / 100));
                            }}
                            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold text-slate-700 min-w-[2rem] text-center">{isWeight ? quantity.toFixed(1) : quantity}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setQuantity((q) => Math.min(stock, Math.round((q + step) * 100) / 100));
                            }}
                            disabled={quantity >= stock}
                            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAdd();
                        }}
                        disabled={outOfStock}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-sm font-bold py-2.5 px-4 rounded-full shadow-lg hover:shadow-xl hover:shadow-purple-200 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {outOfStock ? 'Sin stock' : 'Agregar'}
                    </button>

                </div>
            </div>

        </motion.div>
    );
}

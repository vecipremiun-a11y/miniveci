'use client';

import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { useCart } from '@/components/cart/CartProvider';
import { ArrowLeft, CalendarDays, Clock3, CreditCard, MapPin, Store } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { es } from 'date-fns/locale';

type DeliveryMethod = 'store' | 'delivery';
type PaymentMethod = 'mastercard' | 'visa' | 'apple-pay' | 'other';

const TIME_SLOTS = [
    '09:00 - 12:00',
    '12:00 - 15:00',
    '15:00 - 18:00',
    '18:00 - 21:00',
];

export default function CheckoutPage() {
    const { items, subtotal } = useCart();
    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('visa');
    const [acceptedTerms, setAcceptedTerms] = useState(true);
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(new Date());
    const [deliveryTime, setDeliveryTime] = useState<string>('15:00 - 18:00');
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
    const [couponMessage, setCouponMessage] = useState<string | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);

    const shipping = deliveryMethod === 'delivery' ? 1990 : 0;
    const baseDiscount = subtotal > 50000 ? Math.round(subtotal * 0.05) : 0;

    const normalizedCoupon = (appliedCoupon || '').trim().toUpperCase();
    const couponDiscount =
        normalizedCoupon === 'VECI10'
            ? Math.round(subtotal * 0.1)
            : normalizedCoupon === 'VECI5'
                ? Math.round(subtotal * 0.05)
                : 0;

    const discount = baseDiscount + couponDiscount;
    const total = Math.max(0, subtotal - discount + shipping);

    const money = useMemo(
        () =>
            new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                maximumFractionDigits: 0,
            }),
        []
    );

    const applyCoupon = () => {
        const normalized = couponCode.trim().toUpperCase();

        if (!normalized) {
            setCouponError('Ingresa un código de descuento.');
            setCouponMessage(null);
            setAppliedCoupon(null);
            return;
        }

        if (normalized === 'VECI10' || normalized === 'VECI5') {
            setAppliedCoupon(normalized);
            setCouponError(null);
            setCouponMessage(`Código ${normalized} aplicado correctamente.`);
            return;
        }

        setAppliedCoupon(null);
        setCouponMessage(null);
        setCouponError('Código inválido. Prueba con VECI10 o VECI5.');
    };

    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white pb-20">
            <div className="h-32 md:h-40" />

            <div className="max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-[1.25fr_0.75fr] gap-8 items-start">
                <section className="bg-white/50 backdrop-blur-md border border-white rounded-3xl p-6 md:p-8">
                    <Link href="/carrito" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold">
                        <ArrowLeft className="w-4 h-4" />
                        Volver al carrito
                    </Link>

                    <h1 className="text-4xl font-extrabold text-slate-800 mt-4">Checkout</h1>

                    <div className="mt-8 space-y-10">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-700 mb-4">1. Información de contacto</h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <InputField label="Nombre" defaultValue="Eduard" />
                                <InputField label="Apellido" defaultValue="Franz" />
                                <InputField label="Teléfono" defaultValue="+56 9 5555 0115" />
                                <InputField label="E-mail" defaultValue="correo@ejemplo.com" />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-extrabold text-slate-700 mb-4">2. Método de entrega</h2>
                            <div className="flex flex-wrap gap-3 mb-4">
                                <OptionButton
                                    active={deliveryMethod === 'store'}
                                    onClick={() => setDeliveryMethod('store')}
                                    icon={<Store className="w-4 h-4" />}
                                    label="Retiro en tienda"
                                />
                                <OptionButton
                                    active={deliveryMethod === 'delivery'}
                                    onClick={() => setDeliveryMethod('delivery')}
                                    icon={<MapPin className="w-4 h-4" />}
                                    label="Delivery"
                                />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <DatePickerField
                                    label="Fecha entrega"
                                    value={deliveryDate}
                                    onChange={setDeliveryDate}
                                />
                                <TimePickerField
                                    label="Horario"
                                    value={deliveryTime}
                                    onChange={setDeliveryTime}
                                />
                                <InputField label="Ciudad" defaultValue="Santiago" />
                                <InputField label="Dirección" defaultValue="Av. Principal 2464" />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-extrabold text-slate-700 mb-4">3. Método de pago</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <PayButton active={paymentMethod === 'mastercard'} onClick={() => setPaymentMethod('mastercard')} label="Mastercard" />
                                <PayButton active={paymentMethod === 'visa'} onClick={() => setPaymentMethod('visa')} label="VISA" />
                                <PayButton active={paymentMethod === 'apple-pay'} onClick={() => setPaymentMethod('apple-pay')} label="Apple Pay" />
                                <PayButton active={paymentMethod === 'other'} onClick={() => setPaymentMethod('other')} label="OTRO" />
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="bg-white/70 backdrop-blur-md border border-white rounded-3xl p-6 sticky top-28">
                    <h2 className="text-3xl font-extrabold text-slate-800 mb-5">Orden</h2>

                    <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
                        {items.length === 0 ? (
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600">
                                Tu carrito está vacío. Agrega productos para continuar.
                            </div>
                        ) : (
                            items.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                                    <div className="flex gap-3">
                                        <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                                            <img
                                                src={item.image || '/placeholder-product.svg'}
                                                alt={item.name}
                                                className="w-full h-full object-contain p-2"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-slate-800 leading-tight line-clamp-2">{item.name}</p>
                                            <p className="text-sm text-slate-500 mt-1">Cant: {item.quantity}</p>
                                            <p className="text-base font-extrabold text-slate-700 mt-1">
                                                {money.format(item.price * item.quantity)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/80 p-3.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Código de descuento</p>
                        <div className="flex items-center gap-2">
                            <input
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                placeholder="Ej: VECI10"
                                className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-veci-secondary/50"
                            />
                            <button
                                type="button"
                                onClick={applyCoupon}
                                className="h-10 px-4 rounded-xl btn-primary text-sm font-extrabold"
                            >
                                Aplicar
                            </button>
                        </div>
                        {couponMessage && <p className="text-xs text-emerald-600 font-semibold mt-2">{couponMessage}</p>}
                        {couponError && <p className="text-xs text-red-500 font-semibold mt-2">{couponError}</p>}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-200/80 space-y-2.5 text-sm">
                        <Row label="Subtotal" value={money.format(subtotal)} />
                        <Row label="Descuento" value={discount > 0 ? `-${money.format(discount)}` : money.format(0)} />
                        <Row label="Envío" value={shipping === 0 ? 'Gratis' : money.format(shipping)} />
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200/80 flex items-center justify-between">
                        <span className="text-lg font-bold text-slate-700">Total</span>
                        <span className="text-3xl font-extrabold text-slate-800">{money.format(total)}</span>
                    </div>

                    <button
                        disabled={!acceptedTerms || items.length === 0}
                        className="w-full mt-5 btn-primary rounded-full py-3.5 font-extrabold text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="inline-flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Finalizar compra
                        </span>
                    </button>

                    <label className="mt-4 inline-flex items-start gap-2 text-xs text-slate-500">
                        <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5"
                        />
                        <span>
                            Al confirmar, acepto los términos y condiciones de compra.
                        </span>
                    </label>
                </aside>
            </div>

            <Footer />
        </main>
    );
}

function InputField({
    label,
    defaultValue,
    icon,
}: {
    label: string;
    defaultValue?: string;
    icon?: ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">{label}</span>
            <span className="mt-1.5 flex items-center gap-2 bg-white/80 border border-slate-200 rounded-xl px-3.5 py-3 focus-within:ring-2 focus-within:ring-veci-secondary/50">
                <input
                    defaultValue={defaultValue}
                    className="w-full bg-transparent outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
                />
                {icon}
            </span>
        </label>
    );
}

function DatePickerField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: Date | undefined;
    onChange: (date: Date | undefined) => void;
}) {
    const text = value
        ? value.toLocaleDateString('es-CL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
        : 'Seleccionar fecha';

    return (
        <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">{label}</span>
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="mt-1.5 w-full flex items-center justify-between gap-2 bg-white/80 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-700 hover:bg-white transition-colors"
                    >
                        <span className="truncate">{text}</span>
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border border-slate-200" align="start">
                    <Calendar
                        className="w-[22rem] [--cell-size:2.7rem] p-4 [[data-slot=popover-content]_&]:bg-white"
                        locale={es}
                        formatters={{
                            formatWeekdayName: (date) =>
                                date
                                    .toLocaleDateString('es-CL', { weekday: 'short' })
                                    .replace('.', '')
                                    .slice(0, 2),
                        }}
                        mode="single"
                        selected={value}
                        onSelect={onChange}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                </PopoverContent>
            </Popover>
        </label>
    );
}

function TimePickerField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (time: string) => void;
}) {
    return (
        <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">{label}</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="mt-1.5 h-[50px] bg-white/80 border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-veci-secondary/50 focus:ring-2">
                    <div className="flex items-center justify-between w-full pr-1">
                        <SelectValue placeholder="Seleccionar horario" />
                        <Clock3 className="w-4 h-4 text-slate-400 ml-2" />
                    </div>
                </SelectTrigger>
                <SelectContent className="bg-white border border-slate-200 shadow-lg backdrop-blur-none">
                    {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                            {slot}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </label>
    );
}

function OptionButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                active
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

function PayButton({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-xl border py-3 px-3 text-sm font-extrabold transition-colors ${
                active
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
        >
            {label}
        </button>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-700">{value}</span>
        </div>
    );
}

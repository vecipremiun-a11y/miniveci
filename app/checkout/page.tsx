'use client';

import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { useCart } from '@/components/cart/CartProvider';
import { ArrowLeft, CalendarDays, Clock3, CreditCard, MapPin, Store, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { es } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import AddressAutocomplete from '@/components/AddressAutocomplete';

type DeliveryMethod = 'store' | 'delivery';
type PaymentMethod = 'contrarembolso' | 'transferencia' | 'mercadopago';

const TIME_SLOTS = [
    '09:00 - 12:00',
    '12:00 - 15:00',
    '15:00 - 18:00',
    '18:00 - 21:00',
];

export default function CheckoutPage() {
    const { items, subtotal, clearCart } = useCart();
    const { data: session } = useSession();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('contrarembolso');
    const [acceptedTerms, setAcceptedTerms] = useState(true);
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(new Date());
    const [deliveryTime, setDeliveryTime] = useState<string>('15:00 - 18:00');
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
    const [couponMessage, setCouponMessage] = useState<string | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);

    // Contact fields (auto-filled from customer profile)
    const [contactName, setContactName] = useState('');
    const [contactLastName, setContactLastName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactRut, setContactRut] = useState('');
    const [contactAddress, setContactAddress] = useState('');
    const [contactComuna, setContactComuna] = useState('');
    const [contactCity, setContactCity] = useState('Santiago');
    const [contactNotes, setContactNotes] = useState('');

    // Auto-fill from customer profile
    useEffect(() => {
        if (session?.user?.role !== 'customer') return;
        fetch('/api/store/customer')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                setContactName(data.firstName || '');
                setContactLastName(data.lastName || '');
                setContactPhone(data.phone || '');
                setContactEmail(data.email || '');
                setContactRut(data.rut || '');
                setContactAddress(data.address || '');
                setContactComuna(data.comuna || '');
                setContactCity(data.city || 'Santiago');
                setContactNotes(data.addressNotes || '');
            })
            .catch(() => {});
    }, [session]);

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

    const handleFinalize = async () => {
        setSubmitError('');
        if (items.length === 0) return;
        if (!contactName || !contactEmail) {
            setSubmitError('Nombre y email son requeridos.');
            return;
        }
        if (deliveryMethod === 'delivery' && !contactAddress) {
            setSubmitError('Ingresa una dirección de entrega.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/store/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: contactName,
                    customerLastName: contactLastName,
                    customerEmail: contactEmail,
                    customerPhone: contactPhone,
                    customerRut: contactRut,
                    customerId: session?.user?.role === 'customer' ? (session.user as any).id : null,
                    deliveryType: deliveryMethod === 'store' ? 'pickup' : 'delivery',
                    deliveryDate: deliveryDate?.toISOString().split('T')[0] || null,
                    deliveryTimeSlot: deliveryTime,
                    shippingAddress: contactAddress,
                    shippingComuna: contactComuna,
                    shippingCity: contactCity,
                    shippingNotes: contactNotes,
                    paymentMethod,
                    couponCode: appliedCoupon || null,
                    subtotal,
                    discount,
                    shippingCost: shipping,
                    total,
                    items: items.map(i => ({
                        id: i.id,
                        name: i.name,
                        sku: i.id,
                        quantity: i.quantity,
                        price: i.price,
                    })),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setSubmitError(data.error || 'Error al crear el pedido.');
                return;
            }

            clearCart();
            router.push(`/pedido-exitoso?order=${encodeURIComponent(data.orderNumber)}`);
        } catch {
            setSubmitError('Error de conexión. Intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
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
                                <InputField label="Nombre" value={contactName} onChange={setContactName} />
                                <InputField label="Apellido" value={contactLastName} onChange={setContactLastName} />
                                <InputField label="Teléfono" value={contactPhone} onChange={setContactPhone} />
                                <InputField label="E-mail" value={contactEmail} onChange={setContactEmail} />
                                <InputField label="RUT" value={contactRut} onChange={setContactRut} />
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
                                <div className="sm:col-span-2">
                                    <AddressAutocomplete
                                        address={contactAddress}
                                        comuna={contactComuna}
                                        city={contactCity}
                                        onAddressChange={({ address, comuna, city }) => {
                                            setContactAddress(address);
                                            setContactComuna(comuna);
                                            setContactCity(city);
                                        }}
                                        onManualAddressChange={setContactAddress}
                                    />
                                </div>
                                <InputField label="Notas de entrega" value={contactNotes} onChange={setContactNotes} className="sm:col-span-2" />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-extrabold text-slate-700 mb-4">3. Método de pago</h2>
                            <div className="grid gap-3">
                                <PayButton
                                    active={paymentMethod === 'contrarembolso'}
                                    onClick={() => setPaymentMethod('contrarembolso')}
                                    label="💵 Pago contra entrega"
                                    description="Paga en efectivo o tarjeta cuando recibas tu pedido"
                                />
                                <PayButton
                                    active={paymentMethod === 'transferencia'}
                                    onClick={() => setPaymentMethod('transferencia')}
                                    label="🏦 Transferencia bancaria"
                                    description="Realiza una transferencia y envíanos el comprobante"
                                />
                                <PayButton
                                    active={paymentMethod === 'mercadopago'}
                                    onClick={() => setPaymentMethod('mercadopago')}
                                    label="💳 Mercado Pago"
                                    description="Paga con tarjeta de crédito, débito o cuenta Mercado Pago"
                                />
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
                        onClick={handleFinalize}
                        disabled={!acceptedTerms || items.length === 0 || isSubmitting}
                        className="w-full mt-5 btn-primary rounded-full py-3.5 font-extrabold text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="inline-flex items-center gap-2">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            {isSubmitting ? 'Procesando...' : 'Finalizar compra'}
                        </span>
                    </button>

                    {submitError && (
                        <p className="mt-3 text-sm text-red-500 font-semibold text-center">{submitError}</p>
                    )}

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
    value,
    onChange,
    icon,
    className,
}: {
    label: string;
    value?: string;
    onChange?: (v: string) => void;
    icon?: ReactNode;
    className?: string;
}) {
    return (
        <label className={`block ${className || ''}`}>
            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">{label}</span>
            <span className="mt-1.5 flex items-center gap-2 bg-white/80 border border-slate-200 rounded-xl px-3.5 py-3 focus-within:ring-2 focus-within:ring-veci-secondary/50">
                <input
                    value={value ?? ''}
                    onChange={onChange ? (e) => onChange(e.target.value) : undefined}
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
    description,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    description?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-xl border py-3 px-4 text-left transition-colors ${
                active
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                    : 'bg-white/80 border-slate-200 hover:bg-slate-50'
            }`}
        >
            <span className={`text-sm font-extrabold ${active ? 'text-blue-700' : 'text-slate-700'}`}>{label}</span>
            {description && (
                <p className={`text-xs mt-0.5 ${active ? 'text-blue-500' : 'text-slate-400'}`}>{description}</p>
            )}
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

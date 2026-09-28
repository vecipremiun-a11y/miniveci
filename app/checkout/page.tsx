'use client';

import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { useCart, isWeightUnit, hasEquiv } from '@/components/cart/CartProvider';
import { ArrowLeft, CalendarDays, Clock3, CreditCard, MapPin, Store, Loader2, ChevronDown, Clock, Phone as PhoneIcon, Navigation, Upload, Copy, Check, X, ImageIcon, Pencil, User, Mail, Phone, FileText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { es } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { AddressModal, type SavedAddress } from '@/components/checkout/AddressModal';

/**
 * Ultimo checkout completado en este navegador. Precarga a los invitados y tambien
 * a las cuentas cuyo perfil todavia no tiene el dato (ej. alta con Google, que no
 * pide telefono). ownerId evita que los datos de una cuenta se filtren a otra
 * cuando dos personas usan el mismo navegador.
 */
const CHECKOUT_SNAPSHOT_KEY = 'miniveci:ultimo-checkout';

interface CheckoutSnapshot {
    ownerId: string | null;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    rut: string;
    address: string;
    comuna: string;
    city: string;
    addressNotes: string;
}

function readCheckoutSnapshot(ownerId: string | null): CheckoutSnapshot | null {
    try {
        const raw = localStorage.getItem(CHECKOUT_SNAPSHOT_KEY);
        if (!raw) return null;
        const snap = JSON.parse(raw) as CheckoutSnapshot;
        if ((snap.ownerId ?? null) !== ownerId) return null;
        return snap;
    } catch {
        return null;
    }
}

function saveCheckoutSnapshot(snap: CheckoutSnapshot) {
    try {
        localStorage.setItem(CHECKOUT_SNAPSHOT_KEY, JSON.stringify(snap));
    } catch {
        // localStorage lleno o bloqueado: la precarga es un extra, nunca rompe el pedido.
    }
}

type DeliveryMethod = 'store' | 'delivery';
type PaymentMethod = 'contrarembolso' | 'transferencia' | 'mercadopago';

const TIME_SLOTS = [
    '09:00 - 12:00',
    '12:00 - 15:00',
    '15:00 - 18:00',
    '18:00 - 21:00',
];

export default function CheckoutPage() {
    const { items, subtotal, clearCart, getItemUnitPrice } = useCart();
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('contrarembolso');
    const [acceptedTerms, setAcceptedTerms] = useState(true);
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
    const [hasMounted, setHasMounted] = useState(false);
    const [deliveryTime, setDeliveryTime] = useState<string>('15:00 - 18:00');
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
    const [couponMessage, setCouponMessage] = useState<string | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);

    // Condiciones de envío (costo y monto para envío gratis). Vienen del
    // servidor porque se editan desde el admin; acá son solo para mostrar, el
    // total real lo recalcula el backend al crear el pedido.
    const [deliveryConfig, setDeliveryConfig] = useState({ fee: 0, freeThreshold: 0 });

    useEffect(() => {
        let mounted = true;
        fetch('/api/store/config')
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (!mounted || !data?.delivery) return;
                setDeliveryConfig({
                    fee: Number(data.delivery.fee) || 0,
                    freeThreshold: Number(data.delivery.freeThreshold) || 0,
                });
            })
            .catch(() => { /* si falla, se muestra envío 0 y el server manda igual */ });
        return () => { mounted = false; };
    }, []);

    // Set initial date after mount to avoid hydration mismatch
    useEffect(() => {
        if (!hasMounted) {
            setDeliveryDate(new Date());
            setHasMounted(true);
        }
    }, [hasMounted]);

    // Contact section collapsed when logged in
    const [contactExpanded, setContactExpanded] = useState(false);

    // Contact fields (auto-filled from customer profile)
    const [contactName, setContactName] = useState('');
    const [contactLastName, setContactLastName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactRut, setContactRut] = useState('');
    const [contactAddress, setContactAddress] = useState('');
    const [contactComuna, setContactComuna] = useState('');
    const [contactCity, setContactCity] = useState('');
    const [contactNotes, setContactNotes] = useState('');

    // Transfer receipt
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState('');
    const [receiptUrl, setReceiptUrl] = useState('');
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [copiedField, setCopiedField] = useState('');

    // Saved addresses
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | 'custom'>('custom');
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    // Quien tiene cuenta de tienda (cliente, o admin con cuenta vinculada) elige de
    // su libreta y agrega direcciones en el modal; el invitado escribe la dirección.
    const hasStoreAccount = Boolean(session?.user?.customerId || session?.user?.role === 'customer');

    interface CustomerProfile {
        firstName: string | null; lastName: string | null; phone: string | null;
        email: string | null; rut: string | null;
        address: string | null; comuna: string | null; city: string | null; addressNotes: string | null;
    }

    const prefillStarted = useRef(false);
    const [prefillDone, setPrefillDone] = useState(false);

    // Espejo del valor actual: la precarga es asincrona y necesita saber si ya hay
    // direccion puesta (por un paso anterior o tipeada por el usuario) sin leer estado viejo.
    const contactAddressRef = useRef('');
    useEffect(() => { contactAddressRef.current = contactAddress; }, [contactAddress]);

    // Precarga en cascada: perfil del cliente -> libreta de direcciones -> direccion
    // legacy del perfil -> datos de la sesion -> ultimo checkout de este navegador.
    // La cuenta SIEMPRE manda: cada paso solo rellena lo que sigue vacio, el navegador
    // va ultimo y su copia solo aplica si es del mismo dueño (ver readCheckoutSnapshot).
    useEffect(() => {
        if (sessionStatus === 'loading' || prefillStarted.current) return;
        prefillStarted.current = true;

        const fill = (setter: Dispatch<SetStateAction<string>>, value?: string | null) => {
            const v = (value || '').trim();
            if (v) setter(prev => prev || v);
        };
        // La direccion se aplica como bloque: o entera de una fuente, o ninguna. Evita
        // pegar la calle de la cuenta con la comuna de un pedido viejo del navegador.
        let addressApplied = false;
        const fillAddress = (a: { address?: string | null; comuna?: string | null; city?: string | null; addressNotes?: string | null }) => {
            if (!a.address?.trim()) return;
            if (addressApplied || contactAddressRef.current.trim()) return;
            addressApplied = true;
            fill(setContactAddress, a.address);
            fill(setContactComuna, a.comuna);
            fill(setContactCity, a.city);
            fill(setContactNotes, a.addressNotes);
        };

        const run = async () => {
            const userId = session?.user?.id ?? null;

            // Quien tiene cuenta de tienda: un cliente, o un admin/owner que compra
            // con su cuenta de cliente vinculada (session.user.customerId). Antes
            // se miraba solo el rol y al admin nunca le cargaba su libreta.
            if (session?.user?.customerId || session?.user?.role === 'customer') {
                const profile: CustomerProfile | null = await fetch('/api/store/customer')
                    .then(r => (r.ok ? r.json() : null))
                    .catch(() => null);

                if (profile) {
                    fill(setContactName, profile.firstName);
                    fill(setContactLastName, profile.lastName);
                    fill(setContactPhone, profile.phone);
                    fill(setContactEmail, profile.email);
                    fill(setContactRut, profile.rut);
                }

                const addrs: SavedAddress[] = await fetch('/api/store/customer/addresses')
                    .then(r => (r.ok ? r.json() : []))
                    .catch(() => []);

                if (Array.isArray(addrs) && addrs.length > 0) {
                    setSavedAddresses(addrs);
                    const def = addrs.find(a => a.isDefault) || addrs[0];
                    setSelectedAddressId(def.id);
                    fillAddress(def);
                } else if (profile?.address) {
                    // Cuentas viejas (o registro sin comuna): la direccion solo vive en el perfil.
                    fillAddress(profile);
                }
            }

            // Sesion: cubre a cualquier usuario logueado que no tenga perfil de cliente.
            if (session?.user) {
                const parts = (session.user.name || '').trim().split(/\s+/).filter(Boolean);
                fill(setContactName, parts[0]);
                fill(setContactLastName, parts.slice(1).join(' '));
                fill(setContactEmail, session.user.email);
            }

            // Ultimo checkout de este navegador: lo que el perfil todavia no guarda.
            const snap = readCheckoutSnapshot(userId);
            if (snap) {
                fill(setContactName, snap.firstName);
                fill(setContactLastName, snap.lastName);
                fill(setContactPhone, snap.phone);
                fill(setContactEmail, snap.email);
                fill(setContactRut, snap.rut);
                fillAddress(snap);
            }
        };

        run().finally(() => setPrefillDone(true));
    }, [sessionStatus, session]);

    // Si tras la precarga faltan datos obligatorios, abrir el formulario en vez de
    // mostrar la tarjeta compacta (que los esconderia hasta que el pedido falle).
    useEffect(() => {
        if (prefillDone && (!contactName || !contactPhone)) setContactExpanded(true);
    }, [prefillDone, contactName, contactPhone]);

    // Dirección recién guardada desde el modal: se suma a la libreta y queda elegida.
    const handleAddressSaved = (addr: SavedAddress) => {
        setSavedAddresses(prev => [
            ...(addr.isDefault ? prev.map(a => ({ ...a, isDefault: false })) : prev),
            addr,
        ]);
        setSelectedAddressId(addr.id);
        setContactAddress(addr.address);
        setContactComuna(addr.comuna);
        setContactCity(addr.city);
        setContactNotes(addr.addressNotes || '');
        setAddressModalOpen(false);
    };

    const handleAddressSelect = (id: string) => {
        setSelectedAddressId(id);
        if (id === 'custom') {
            setContactAddress('');
            setContactComuna('');
            setContactCity('');
            setContactNotes('');
            return;
        }
        const addr = savedAddresses.find(a => a.id === id);
        if (addr) {
            setContactAddress(addr.address);
            setContactComuna(addr.comuna);
            setContactCity(addr.city);
            setContactNotes(addr.addressNotes || '');
        }
    };

    const baseDiscount = subtotal > 50000 ? Math.round(subtotal * 0.05) : 0;

    const normalizedCoupon = (appliedCoupon || '').trim().toUpperCase();
    const couponDiscount =
        normalizedCoupon === 'VECI10'
            ? Math.round(subtotal * 0.1)
            : normalizedCoupon === 'VECI5'
                ? Math.round(subtotal * 0.05)
                : 0;

    const discount = baseDiscount + couponDiscount;

    // Mismo criterio que lib/store-config.ts: el envío gratis se mide contra lo
    // que realmente se paga en productos (subtotal ya con descuentos).
    const payableSubtotal = Math.max(0, subtotal - discount);
    const freeDeliveryOn = deliveryConfig.freeThreshold > 0;
    const reachedFreeDelivery = freeDeliveryOn && payableSubtotal >= deliveryConfig.freeThreshold;
    const missingForFreeDelivery = freeDeliveryOn
        ? Math.max(0, deliveryConfig.freeThreshold - payableSubtotal)
        : 0;
    const shipping = deliveryMethod === 'delivery' && !reachedFreeDelivery ? deliveryConfig.fee : 0;
    const total = Math.max(0, payableSubtotal + shipping);

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

    const handleReceiptUpload = async (file: File) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setSubmitError('Formato no válido. Sube una imagen (JPG, PNG, WebP) o PDF.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setSubmitError('El archivo es muy grande. Máximo 5MB.');
            return;
        }

        setReceiptFile(file);
        setSubmitError('');

        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setReceiptPreview(url);
        } else {
            setReceiptPreview('');
        }

        // Upload immediately
        setUploadingReceipt(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/store/upload-receipt', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) {
                setSubmitError(data.error || 'Error al subir comprobante.');
                setReceiptFile(null);
                setReceiptPreview('');
                return;
            }
            setReceiptUrl(data.url);
        } catch {
            setSubmitError('Error de conexión al subir comprobante.');
            setReceiptFile(null);
            setReceiptPreview('');
        } finally {
            setUploadingReceipt(false);
        }
    };

    const removeReceipt = () => {
        setReceiptFile(null);
        setReceiptPreview('');
        setReceiptUrl('');
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(''), 2000);
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
        if (deliveryMethod === 'delivery' && !contactPhone.trim()) {
            setContactExpanded(true);
            setSubmitError('Ingresa un teléfono de contacto para coordinar la entrega.');
            return;
        }
        if (paymentMethod === 'transferencia' && !receiptUrl) {
            setSubmitError('Sube el comprobante de transferencia antes de finalizar.');
            return;
        }

        setIsSubmitting(true);
        // Se guarda al confirmar para que el proximo checkout salga precargado incluso
        // sin cuenta. Para clientes logueados el backend ademas completa su perfil.
        const persistSnapshot = () => saveCheckoutSnapshot({
            ownerId: session?.user?.id ?? null,
            firstName: contactName,
            lastName: contactLastName,
            phone: contactPhone,
            email: contactEmail,
            rut: contactRut,
            address: deliveryMethod === 'delivery' ? contactAddress : '',
            comuna: deliveryMethod === 'delivery' ? contactComuna : '',
            city: deliveryMethod === 'delivery' ? contactCity : '',
            addressNotes: deliveryMethod === 'delivery' ? contactNotes : '',
        });
        try {
            const orderPayload = {
                customerName: contactName,
                customerLastName: contactLastName,
                customerEmail: contactEmail,
                customerPhone: contactPhone,
                customerRut: contactRut,
                customerId: session?.user?.role === 'customer' ? session.user.id : null,
                deliveryType: deliveryMethod === 'store' ? 'pickup' : 'delivery',
                deliveryDate: deliveryDate?.toISOString().split('T')[0] || null,
                deliveryTimeSlot: deliveryTime,
                shippingAddress: contactAddress,
                shippingComuna: contactComuna,
                shippingCity: contactCity,
                shippingNotes: contactNotes,
                paymentMethod,
                paymentId: paymentMethod === 'transferencia' ? receiptUrl : null,
                couponCode: appliedCoupon || null,
                subtotal,
                discount,
                shippingCost: shipping,
                total,
                items: items.map(i => {
                    const equiv = hasEquiv(i);
                    const realId = i.id.replace(/__kg$/, '');
                    const posQuantity = equiv
                        ? Math.round(i.quantity * i.equivWeight! * 1000) / 1000
                        : i.quantity;
                    const unitPrice = equiv
                        ? Math.round(i.price * i.equivWeight!)
                        : i.price;
                    return {
                        id: realId,
                        name: i.name,
                        sku: realId,
                        quantity: posQuantity,
                        price: unitPrice,
                        displayQuantity: equiv ? i.quantity : undefined,
                        equivLabel: equiv ? i.equivLabel : undefined,
                    };
                }),
            };

            // Mercado Pago flow: create order + preference, then redirect
            if (paymentMethod === 'mercadopago') {
                const res = await fetch('/api/store/payments/create-preference', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload),
                });
                const data = await res.json();
                if (!res.ok) {
                    setSubmitError(data.error || 'Error al crear el pago con Mercado Pago.');
                    return;
                }
                // Redirect to Mercado Pago checkout
                persistSnapshot();
                clearCart();
                const redirectUrl = data.initPoint || data.sandboxInitPoint;
                if (redirectUrl) {
                    window.location.href = redirectUrl;
                } else {
                    setSubmitError('No se pudo obtener la URL de pago.');
                }
                return;
            }

            // Regular flow (contrarembolso / transferencia)
            const res = await fetch('/api/store/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload),
            });

            const data = await res.json();
            if (!res.ok) {
                setSubmitError(data.error || 'Error al crear el pedido.');
                return;
            }

            persistSnapshot();
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
            <div className="h-36 md:h-40" />

            <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 grid lg:grid-cols-[1.25fr_0.75fr] gap-4 sm:gap-8 items-start">
                <section className="bg-white/50 backdrop-blur-md border border-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8">
                    <Link href="/carrito" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold text-sm">
                        <ArrowLeft className="w-4 h-4" />
                        Volver al carrito
                    </Link>

                    <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-800 mt-3 sm:mt-4">Checkout</h1>

                    <div className="mt-6 sm:mt-8 space-y-6 sm:space-y-10">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-700 mb-4">1. Información de contacto</h2>
                            {session?.user && contactName && !contactExpanded ? (
                                <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-veci-primary/10 flex items-center justify-center flex-shrink-0">
                                                <User className="w-4 h-4 text-veci-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{contactName} {contactLastName}</p>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                                                    {contactEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{contactEmail}</span>}
                                                    {contactPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{contactPhone}</span>}
                                                    {contactRut && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{contactRut}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setContactExpanded(true)}
                                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0"
                                            title="Editar datos"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {session?.user && contactName && (
                                        <button
                                            type="button"
                                            onClick={() => setContactExpanded(false)}
                                            className="text-xs font-semibold text-veci-primary hover:underline"
                                        >
                                            ← Contraer
                                        </button>
                                    )}
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <InputField label="Nombre" value={contactName} onChange={setContactName} />
                                        <InputField label="Apellido" value={contactLastName} onChange={setContactLastName} />
                                        <InputField label="Teléfono" value={contactPhone} onChange={setContactPhone} />
                                        <InputField label="E-mail" value={contactEmail} onChange={setContactEmail} />
                                        <InputField label="RUT" value={contactRut} onChange={setContactRut} />
                                    </div>
                                </div>
                            )}
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

                            {deliveryMethod === 'store' ? (
                                <div className="mt-4 space-y-4">
                                    <div className="rounded-2xl border-2 border-veci-primary/30 bg-gradient-to-br from-veci-primary/5 to-veci-secondary/5 p-5 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-emerald-400 text-white text-[10px] font-extrabold uppercase tracking-wider px-4 py-1 rounded-bl-xl shadow-md">
                                            Abierto todos los días
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-veci-primary/10 flex items-center justify-center flex-shrink-0">
                                                <Store className="w-6 h-6 text-veci-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-800 text-base">MiniVeci - Retiro en tienda</h3>
                                                <div className="mt-3 space-y-2">
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <Navigation className="w-4 h-4 text-veci-primary flex-shrink-0" />
                                                        <span>Sotomayor 1460-A, Iquique</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <Clock className="w-4 h-4 text-veci-primary flex-shrink-0" />
                                                        <span>Lunes a Domingo: 7:00 AM - 11:00 PM</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <PhoneIcon className="w-4 h-4 text-veci-primary flex-shrink-0" />
                                                        <span>+56 9 5022 5491</span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 pt-3 border-t border-veci-primary/10">
                                                    <p className="text-xs text-slate-500">Presenta tu número de pedido al momento del retiro. Tendrás <strong>48 horas</strong> para retirar tu pedido desde la confirmación.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <DatePickerField label="Fecha de retiro" value={deliveryDate} onChange={setDeliveryDate} />
                                        <TimePickerField label="Horario estimado" value={deliveryTime} onChange={setDeliveryTime} />
                                    </div>
                                </div>
                            ) : (
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

                                {hasStoreAccount ? (
                                    <div className="sm:col-span-2">
                                        <span className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Dirección de envío</span>
                                        <div className="mt-1.5 grid sm:grid-cols-2 gap-3">
                                            {savedAddresses.map(addr => {
                                                const selected = selectedAddressId === addr.id;
                                                return (
                                                    <button
                                                        key={addr.id}
                                                        type="button"
                                                        onClick={() => handleAddressSelect(addr.id)}
                                                        aria-pressed={selected}
                                                        className={`relative text-left p-4 rounded-2xl border-2 transition-all ${selected ? 'border-veci-primary bg-veci-primary/5 shadow-sm' : 'border-slate-200 bg-white/80 hover:border-slate-300'}`}
                                                    >
                                                        {selected && (
                                                            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-veci-primary text-white flex items-center justify-center">
                                                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-2 pr-6">
                                                            <MapPin className={`w-4 h-4 shrink-0 ${selected ? 'text-veci-primary' : 'text-slate-400'}`} />
                                                            <span className="text-sm font-bold text-slate-700 truncate">{addr.label}</span>
                                                            {addr.isDefault && (
                                                                <span className="text-[10px] font-bold text-veci-primary bg-veci-primary/10 px-2 py-0.5 rounded-full shrink-0">Predeterminada</span>
                                                            )}
                                                        </span>
                                                        <span className="block mt-1.5 text-sm text-slate-600 leading-snug">{addr.address}</span>
                                                        <span className="block text-xs text-slate-400">{[addr.comuna, addr.city].filter(Boolean).join(', ')}</span>
                                                        {addr.addressNotes && (
                                                            <span className="block mt-1 text-xs text-slate-400 italic line-clamp-1">{addr.addressNotes}</span>
                                                        )}
                                                    </button>
                                                );
                                            })}

                                            {/* Sin libreta pero con una dirección precargada (perfil o último pedido) */}
                                            {savedAddresses.length === 0 && contactAddress && (
                                                <div className="relative text-left p-4 rounded-2xl border-2 border-veci-primary bg-veci-primary/5">
                                                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-veci-primary text-white flex items-center justify-center">
                                                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                    </span>
                                                    <span className="flex items-center gap-2 pr-6">
                                                        <MapPin className="w-4 h-4 shrink-0 text-veci-primary" />
                                                        <span className="text-sm font-bold text-slate-700">Última dirección usada</span>
                                                    </span>
                                                    <span className="block mt-1.5 text-sm text-slate-600 leading-snug">{contactAddress}</span>
                                                    <span className="block text-xs text-slate-400">{[contactComuna, contactCity].filter(Boolean).join(', ')}</span>
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => setAddressModalOpen(true)}
                                                className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[104px] rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-veci-primary hover:text-veci-primary hover:bg-veci-primary/5 transition-all"
                                            >
                                                <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold leading-none">+</span>
                                                <span className="text-sm font-bold">Agregar dirección</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
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
                                )}
                                <InputField label="Notas de entrega" value={contactNotes} onChange={setContactNotes} className="sm:col-span-2" />
                            </div>
                            )}
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
                                >
                                    <div className="space-y-3">
                                        {/* Bank details */}
                                        <div className="space-y-2">
                                            {[
                                                { label: 'Banco', value: 'Banco Estado', key: 'banco' },
                                                { label: 'Nombre', value: 'Kevin Javier', key: 'nombre' },
                                                { label: 'Tipo de cuenta', value: 'Chequera Electrónica (Cuenta Vista)', key: 'tipo' },
                                                { label: 'N° de cuenta', value: '1371455597', key: 'cuenta' },
                                                { label: 'Monto a transferir', value: money.format(total), key: 'monto' },
                                            ].map(({ label, value, key }) => (
                                                <div key={key} className="flex items-center justify-between bg-white/80 rounded-lg px-3 py-2">
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">{label}</p>
                                                        <p className={`text-sm font-bold ${key === 'monto' ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(key === 'monto' ? String(total) : value, key)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                                        title="Copiar"
                                                    >
                                                        {copiedField === key ? (
                                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5 text-blue-400" />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Receipt upload */}
                                        <div className="pt-2 border-t border-blue-200/50">
                                            <p className="text-xs font-bold text-slate-600 mb-1">📎 Comprobante de transferencia</p>
                                            <p className="text-[11px] text-slate-400 mb-2">Sube una captura o foto del comprobante para validar tu pago</p>

                                            {!receiptFile ? (
                                                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300/60 hover:border-blue-400 bg-white/50 hover:bg-white/80 p-5 cursor-pointer transition-colors">
                                                    <Upload className="w-6 h-6 text-slate-400" />
                                                    <div className="text-center">
                                                        <p className="text-xs font-bold text-slate-600">Haz clic para subir tu comprobante</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP o PDF — Máx 5MB</p>
                                                    </div>
                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp,application/pdf"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const f = e.target.files?.[0];
                                                            if (f) handleReceiptUpload(f);
                                                        }}
                                                    />
                                                </label>
                                            ) : (
                                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                                    <div className="flex items-start gap-3">
                                                        {receiptPreview ? (
                                                            <img src={receiptPreview} alt="Comprobante" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                                                        ) : (
                                                            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
                                                                <ImageIcon className="w-6 h-6 text-slate-400" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-700 truncate">{receiptFile.name}</p>
                                                            <p className="text-xs text-slate-400 mt-0.5">{(receiptFile.size / 1024).toFixed(0)} KB</p>
                                                            {uploadingReceipt && (
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                                                    <span className="text-xs font-semibold text-blue-500">Subiendo...</span>
                                                                </div>
                                                            )}
                                                            {receiptUrl && !uploadingReceipt && (
                                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                                    <span className="text-xs font-semibold text-emerald-600">Comprobante subido</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={removeReceipt}
                                                            className="p-1 rounded-lg hover:bg-red-50 transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </PayButton>
                                <PayButton
                                    active={paymentMethod === 'mercadopago'}
                                    onClick={() => setPaymentMethod('mercadopago')}
                                    label="💳 Mercado Pago"
                                    description="Paga con tarjeta de crédito, débito o saldo de Mercado Pago"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="bg-white/70 backdrop-blur-md border border-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:sticky lg:top-[calc(7rem+var(--promo-h,0px))]">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-4 sm:mb-5">Orden</h2>

                    <div className="space-y-3 sm:space-y-4 max-h-[420px] overflow-auto pr-1">
                        {items.length === 0 ? (
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600">
                                Tu carrito está vacío. Agrega productos para continuar.
                            </div>
                        ) : (
                            items.map((item) => (
                                <div key={item.id} className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/70 p-3 sm:p-4">
                                    <div className="flex gap-3">
                                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl bg-slate-100 overflow-hidden shrink-0">
                                            <img
                                                src={item.image || '/placeholder-product.svg'}
                                                alt={item.name}
                                                className="w-full h-full object-contain p-2"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-slate-800 leading-tight line-clamp-2 text-sm sm:text-base">{item.name}</p>
                                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                                {hasEquiv(item)
                                                    ? `Cant: ${item.quantity} ${item.equivLabel}`
                                                    : `Cant: ${isWeightUnit(item.unit) ? `${item.quantity.toFixed(1)} ${(item.unit ?? 'kg').toLowerCase()}` : item.quantity}`}
                                            </p>
                                            <p className="text-sm sm:text-base font-extrabold text-slate-700 mt-1">
                                                {money.format(hasEquiv(item) ? Math.round(getItemUnitPrice(item) * item.equivWeight! * item.quantity) : getItemUnitPrice(item) * item.quantity)}
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
                        {deliveryMethod === 'delivery' && reachedFreeDelivery && (
                            <p className="text-xs font-bold text-emerald-600">
                                ¡Tu compra tiene envío gratis!
                            </p>
                        )}
                        {deliveryMethod === 'delivery' && !reachedFreeDelivery && missingForFreeDelivery > 0 && (
                            <p className="text-xs font-semibold text-slate-500">
                                Te faltan <span className="text-veci-primary">{money.format(missingForFreeDelivery)}</span> para
                                tener envío gratis.
                            </p>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200/80 flex items-center justify-between">
                        <span className="text-base sm:text-lg font-bold text-slate-700">Total</span>
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-800">{money.format(total)}</span>
                    </div>

                    <button
                        onClick={handleFinalize}
                        disabled={!acceptedTerms || items.length === 0 || isSubmitting || (paymentMethod === 'transferencia' && (!receiptUrl || uploadingReceipt))}
                        className="w-full mt-5 btn-primary rounded-full py-3.5 font-extrabold text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="inline-flex items-center gap-2">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            {isSubmitting ? 'Procesando...' : paymentMethod === 'mercadopago' ? 'Pagar con Mercado Pago' : 'Finalizar compra'}
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

            <AddressModal
                open={addressModalOpen}
                onClose={() => setAddressModalOpen(false)}
                onSaved={handleAddressSaved}
                isFirst={savedAddresses.length === 0}
            />

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
                        disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return date < today;
                        }}
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
    children,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    description?: string;
    children?: ReactNode;
}) {
    return (
        <div
            className={`rounded-xl border text-left transition-all overflow-hidden ${
                active
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                    : 'bg-white/80 border-slate-200 hover:bg-slate-50'
            }`}
        >
            <button onClick={onClick} className="w-full py-3 px-4 text-left">
                <span className={`text-sm font-extrabold ${active ? 'text-blue-700' : 'text-slate-700'}`}>{label}</span>
                {description && (
                    <p className={`text-xs mt-0.5 ${active ? 'text-blue-500' : 'text-slate-400'}`}>{description}</p>
                )}
            </button>
            {active && children && (
                <div className="px-4 pb-4 border-t border-blue-200/60 mt-0 pt-3">
                    {children}
                </div>
            )}
        </div>
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

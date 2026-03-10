'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, User, Phone, MapPin, FileText, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { signIn } from 'next-auth/react';
import AddressAutocomplete from '@/components/AddressAutocomplete';

export default function RegisterPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<1 | 2>(1);

    // Step 1: Cuenta
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Step 2: Dirección (para checkout)
    const [rut, setRut] = useState('');
    const [rutError, setRutError] = useState('');
    const [address, setAddress] = useState('');
    const [comuna, setComuna] = useState('');
    const [city, setCity] = useState('Santiago');
    const [addressNotes, setAddressNotes] = useState('');

    // Formatea RUT chileno: 12.345.678-K
    const formatRut = (value: string) => {
        let clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
        if (clean.length > 9) clean = clean.slice(0, 9);
        if (clean.length <= 1) return clean;
        const body = clean.slice(0, -1);
        const dv = clean.slice(-1);
        const reversed = body.split('').reverse();
        const groups: string[] = [];
        for (let i = 0; i < reversed.length; i += 3) {
            groups.push(reversed.slice(i, i + 3).reverse().join(''));
        }
        return groups.reverse().join('.') + '-' + dv;
    };

    // Valida dígito verificador del RUT chileno
    const validateRut = (formatted: string): boolean => {
        const clean = formatted.replace(/[^0-9kK]/g, '').toUpperCase();
        if (clean.length < 2) return false;
        const body = clean.slice(0, -1);
        const dv = clean.slice(-1);
        let sum = 0;
        let mul = 2;
        for (let i = body.length - 1; i >= 0; i--) {
            sum += parseInt(body[i]) * mul;
            mul = mul === 7 ? 2 : mul + 1;
        }
        const remainder = 11 - (sum % 11);
        const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
        return dv === expected;
    };

    const handleRutChange = (value: string) => {
        const formatted = formatRut(value);
        setRut(formatted);
        const clean = formatted.replace(/[^0-9kK]/g, '');
        // Solo validar cuando el RUT tiene largo completo (mín 7 dígitos + DV = 8 chars)
        // RUTs chilenos van desde ~4.000.000 hasta 99.999.999+
        if (clean.length >= 8) {
            if (!validateRut(formatted)) {
                setRutError('RUT inválido, verifica el número');
            } else {
                setRutError('');
            }
        } else if (clean.length >= 2 && clean.length < 8) {
            // Mientras escribe, no mostrar error aún
            setRutError('');
        } else {
            setRutError('');
        }
    };

    const handleStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    phone,
                    password,
                    rut: rut || undefined,
                    address: address || undefined,
                    comuna: comuna || undefined,
                    city: city || undefined,
                    addressNotes: addressNotes || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || data.details?.[0] || 'Error al crear la cuenta');
                return;
            }

            // Auto login after register
            const loginResult = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (loginResult?.error) {
                router.push('/login');
            } else {
                router.push('/cuenta');
                router.refresh();
            }
        } catch {
            setError('Ocurrió un error al crear la cuenta');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-veci-blue-900/5 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-20 left-20 w-72 h-72 bg-veci-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-veci-secondary/20 rounded-full blur-3xl" />

            <div className="w-full max-w-lg p-8 bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl relative z-10 mx-4">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-veci-primary to-veci-secondary flex items-center justify-center text-white font-bold text-3xl shadow-lg mx-auto mb-4 transform -rotate-3">
                        N
                    </div>
                    <h1 className="text-3xl font-bold text-veci-dark mb-2">Crear tu cuenta</h1>
                    <p className="text-slate-500">
                        {step === 1 ? 'Completa tus datos personales' : 'Agrega tu dirección de entrega'}
                    </p>
                </div>

                {/* Step Indicators */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${step === 1 ? 'bg-gradient-to-r from-veci-primary to-veci-secondary text-white shadow-md' : 'bg-emerald-100 text-emerald-600'}`}>
                        {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        <span>Cuenta</span>
                    </div>
                    <div className="w-8 h-0.5 bg-slate-200 rounded-full" />
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${step === 2 ? 'bg-gradient-to-r from-veci-primary to-veci-secondary text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                        <MapPin className="w-4 h-4" />
                        <span>Dirección</span>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl mb-6">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Step 1: Personal Info */}
                {step === 1 && (
                    <form onSubmit={handleStep1} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Nombre</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                                    <input
                                        type="text"
                                        required
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Juan"
                                        className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Apellido</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                                    <input
                                        type="text"
                                        required
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Pérez"
                                        className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Correo Electrónico</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                                <input
                                    type="text"
                                    inputMode="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => {
                                        if ((e.ctrlKey && e.altKey && e.key === 'q') || (e.ctrlKey && e.altKey && e.key === 'Q')) {
                                            e.preventDefault();
                                            const input = e.currentTarget;
                                            const start = input.selectionStart ?? email.length;
                                            const end = input.selectionEnd ?? email.length;
                                            setEmail(email.slice(0, start) + '@' + email.slice(end));
                                            setTimeout(() => input.setSelectionRange(start + 1, start + 1), 0);
                                        }
                                    }}
                                    placeholder="ejemplo@correo.com"
                                    className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Teléfono</label>
                            <div className="relative group">
                                <Phone className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+56 9 1234 5678"
                                    className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-12 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white font-bold py-4 rounded-2xl shadow-lg shadow-veci-primary/25 hover:shadow-xl hover:shadow-veci-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                        >
                            <span>Siguiente</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                )}

                {/* Step 2: Address */}
                {step === 2 && (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">RUT <span className="text-slate-400 font-normal">(opcional)</span></label>
                            <div className="relative group">
                                <FileText className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                                <input
                                    type="text"
                                    value={rut}
                                    onChange={(e) => handleRutChange(e.target.value)}
                                    placeholder="12.345.678-9"
                                    maxLength={12}
                                    className={`w-full bg-white/50 border focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 transition-all font-medium text-slate-700 placeholder:text-slate-400 ${
                                        rutError ? 'border-red-300 focus:ring-red-300/50' : 'border-white focus:ring-veci-primary/50'
                                    }`}
                                />
                            </div>
                            {rutError && <p className="text-xs text-red-500 font-semibold ml-1">{rutError}</p>}
                        </div>

                        <AddressAutocomplete
                            address={address}
                            comuna={comuna}
                            city={city}
                            onAddressChange={({ address: a, comuna: c, city: ci }) => {
                                setAddress(a);
                                setComuna(c);
                                setCity(ci);
                            }}
                            onManualAddressChange={setAddress}
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Notas de entrega <span className="text-slate-400 font-normal">(opcional)</span></label>
                            <div className="relative group">
                                <FileText className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                                <input
                                    type="text"
                                    value={addressNotes}
                                    onChange={(e) => setAddressNotes(e.target.value)}
                                    placeholder="Portón negro, tocar timbre 3"
                                    className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); }}
                                className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                            >
                                Volver
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-[2] bg-gradient-to-r from-veci-primary to-veci-secondary text-white font-bold py-4 rounded-2xl shadow-lg shadow-veci-primary/25 hover:shadow-xl hover:shadow-veci-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>Crear cuenta</span>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-8 text-center text-sm text-slate-500 font-medium">
                    ¿Ya tienes una cuenta?{' '}
                    <Link href="/login" className="text-veci-primary hover:text-veci-secondary font-bold hover:underline transition-all">
                        Inicia sesión
                    </Link>
                </div>
            </div>
        </div>
    );
}

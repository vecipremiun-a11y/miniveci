'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';

const ADMIN_ROLES = ['owner', 'admin', 'preparacion', 'reparto', 'contenido'];

export default function LoginPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Correo o contraseña incorrectos');
            } else {
                // Fetch latest session to determine role
                const res = await fetch('/api/auth/session');
                const sess = await res.json();
                const role = sess?.user?.role;

                if (role && ADMIN_ROLES.includes(role)) {
                    router.push('/admin');
                } else {
                    router.push('/cuenta');
                }
                router.refresh();
            }
        } catch {
            setError('Ocurrió un error al iniciar sesión');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-veci-blue-900/5 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-20 left-20 w-72 h-72 bg-veci-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-veci-secondary/20 rounded-full blur-3xl" />

            <div className="w-full max-w-md p-8 bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl relative z-10 mx-4">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-veci-primary to-veci-secondary flex items-center justify-center text-white font-bold text-3xl shadow-lg mx-auto mb-4 transform rotate-3">
                        N
                    </div>
                    <h1 className="text-3xl font-bold text-veci-dark mb-2">¡Hola de nuevo!</h1>
                    <p className="text-slate-500">Ingresa a tu cuenta para continuar</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
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
                        <label className="text-sm font-semibold text-slate-700 ml-1">Contraseña</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="text-right">
                            <Link href="#" className="text-xs font-semibold text-veci-primary hover:text-veci-secondary transition-colors">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white font-bold py-4 rounded-2xl shadow-lg shadow-veci-primary/25 hover:shadow-xl hover:shadow-veci-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <span>Iniciar Sesión</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500 font-medium">
                    ¿No tienes una cuenta?{' '}
                    <Link href="/registro" className="text-veci-primary hover:text-veci-secondary font-bold hover:underline transition-all">
                        Regístrate aquí
                    </Link>
                </div>
            </div>
        </div>
    );
}

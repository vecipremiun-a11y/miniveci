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

    const handleGoogleSignIn = async () => {
        setError('');
        // signIn de Google redirige al provider y vuelve al callbackUrl.
        // No usamos redirect:false porque OAuth flow requiere navegación.
        await signIn('google', { callbackUrl: '/cuenta' });
    };

    return (
        <div className="min-h-screen pt-36 sm:pt-32 pb-12 flex items-center justify-center bg-veci-blue-900/5 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-20 left-20 w-72 h-72 bg-veci-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-veci-secondary/20 rounded-full blur-3xl" />

            <div className="w-full max-w-md p-5 sm:p-8 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl sm:rounded-3xl shadow-2xl relative z-10 mx-3 sm:mx-4">
                <div className="text-center mb-5 sm:mb-8">
                    <img src="/logo%20veci.png" alt="MiniVeci" className="w-20 h-20 sm:w-24 sm:h-24 object-contain mx-auto mb-3 sm:mb-4 drop-shadow-md" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-veci-dark mb-1 sm:mb-2">¡Hola de nuevo!</h1>
                    <p className="text-slate-500 text-sm sm:text-base">Ingresa a tu cuenta para continuar</p>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full mb-5 flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-3 rounded-2xl shadow-sm hover:shadow transition-all disabled:opacity-50"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continuar con Google
                </button>

                <div className="flex items-center gap-3 mb-5 text-xs font-semibold text-slate-400">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span>o con email</span>
                    <div className="flex-1 h-px bg-slate-200" />
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

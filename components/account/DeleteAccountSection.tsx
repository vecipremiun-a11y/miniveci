'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

/**
 * "Eliminar mi cuenta" en Ajustes. Pide escribir ELIMINAR para confirmar y
 * llama a DELETE /api/store/customer; si sale bien, cierra la sesión.
 * Qué se borra y qué se conserva está en /politica-privacidad#eliminar-cuenta.
 */
export function DeleteAccountSection() {
    const [open, setOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deleting) setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, deleting]);

    const close = () => {
        if (deleting) return;
        setOpen(false);
        setConfirmText('');
        setError('');
    };

    const handleDelete = async () => {
        setDeleting(true);
        setError('');
        try {
            const res = await fetch('/api/store/customer', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: 'ELIMINAR' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || 'No se pudo eliminar la cuenta. Intenta de nuevo.');
                setDeleting(false);
                return;
            }
            try { localStorage.removeItem('miniveci:ultimo-checkout'); } catch { /* sin storage */ }
            await signOut({ callbackUrl: '/?cuenta=eliminada' });
        } catch {
            setError('No se pudo eliminar la cuenta. Revisa tu conexión.');
            setDeleting(false);
        }
    };

    return (
        <div className="mt-8 pt-6 border-t border-red-100">
            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Eliminar cuenta
            </h3>
            <p className="text-sm text-slate-500 max-w-2xl">
                Se borran tu perfil, direcciones, conversaciones del chat y notificaciones. Tus pedidos anteriores se conservan
                sin tus datos personales, por obligaciones tributarias.{' '}
                <Link href="/politica-privacidad#eliminar-cuenta" className="underline underline-offset-2 hover:text-slate-700">
                    Más información
                </Link>
            </p>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors"
            >
                <Trash2 className="w-4 h-4" /> Eliminar mi cuenta
            </button>

            {open && (
                <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={close} />
                    <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-7">
                        <button type="button" onClick={close} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label="Cerrar">
                            <X className="w-5 h-5" />
                        </button>
                        <span className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-4">
                            <Trash2 className="w-5 h-5 text-red-500" />
                        </span>
                        <h3 id="delete-account-title" className="text-lg font-extrabold text-slate-800">¿Eliminar tu cuenta?</h3>
                        <p className="mt-2 text-sm text-slate-500">
                            Esta acción no se puede deshacer. Perderás tus direcciones guardadas, tu historial en la cuenta y el acceso
                            con este correo. Si más adelante quieres volver a comprar, tendrás que crear una cuenta nueva.
                        </p>
                        <label className="block mt-5">
                            <span className="text-xs font-bold text-slate-500">Escribe <strong className="text-red-600">ELIMINAR</strong> para confirmar</span>
                            <input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                autoComplete="off"
                                className="mt-1.5 w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                            />
                        </label>
                        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
                        <div className="mt-6 flex gap-3">
                            <button type="button" onClick={close} disabled={deleting} className="flex-1 py-3 rounded-full border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-60">
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={confirmText.trim().toUpperCase() !== 'ELIMINAR' || deleting}
                                className="flex-1 py-3 rounded-full bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Eliminar cuenta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

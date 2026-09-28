'use client';

import { useEffect, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import AddressAutocomplete from '@/components/AddressAutocomplete';

export interface SavedAddress {
    id: string;
    label: string;
    address: string;
    comuna: string;
    city: string;
    addressNotes: string | null;
    isDefault: boolean;
}

interface AddressModalProps {
    open: boolean;
    onClose: () => void;
    /** Recibe la dirección recién guardada (ya con id) para seleccionarla. */
    onSaved: (address: SavedAddress) => void;
    /** Si es la primera, el servidor la deja como predeterminada igual. */
    isFirst: boolean;
}

const LABELS = ['Casa', 'Trabajo', 'Otro'];

/**
 * Modal del checkout para agregar una dirección a la libreta del cliente.
 * Guarda contra /api/store/customer/addresses (la misma de "Mis direcciones"),
 * así la dirección queda disponible para los próximos pedidos.
 */
export function AddressModal({ open, onClose, onSaved, isFirst }: AddressModalProps) {
    const [label, setLabel] = useState('Casa');
    const [customLabel, setCustomLabel] = useState('');
    const [address, setAddress] = useState('');
    const [comuna, setComuna] = useState('');
    const [city, setCity] = useState('');
    const [notes, setNotes] = useState('');
    const [makeDefault, setMakeDefault] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Cerrar con Escape y bloquear el scroll de fondo mientras está abierto.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    const reset = () => {
        setLabel('Casa');
        setCustomLabel('');
        setAddress('');
        setComuna('');
        setCity('');
        setNotes('');
        setMakeDefault(false);
        setError('');
    };

    const handleSave = async () => {
        const finalLabel = label === 'Otro' ? (customLabel.trim() || 'Otro') : label;
        if (!address.trim() || !comuna.trim()) {
            setError('Ingresa la dirección y la comuna.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const payload = {
                label: finalLabel,
                address: address.trim(),
                comuna: comuna.trim(),
                city: city.trim() || comuna.trim(),
                addressNotes: notes.trim() || null,
                isDefault: makeDefault,
            };
            const res = await fetch('/api/store/customer/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.id) {
                setError(data?.error || 'No se pudo guardar la dirección. Intenta de nuevo.');
                return;
            }
            onSaved({ id: data.id, ...payload, isDefault: makeDefault || isFirst });
            reset();
        } catch {
            setError('No se pudo guardar la dirección. Revisa tu conexión.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-7 animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-full bg-veci-primary/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-veci-primary" />
                        </span>
                        <div>
                            <h3 id="address-modal-title" className="text-lg font-extrabold text-slate-800">Nueva dirección</h3>
                            <p className="text-xs text-slate-500">Queda guardada en tu cuenta para los próximos pedidos.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Nombre</span>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                            {LABELS.map((l) => (
                                <button
                                    key={l}
                                    type="button"
                                    onClick={() => setLabel(l)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${label === l ? 'border-veci-primary bg-veci-primary/10 text-veci-dark' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                        {label === 'Otro' && (
                            <input
                                value={customLabel}
                                onChange={(e) => setCustomLabel(e.target.value)}
                                maxLength={30}
                                placeholder="Ej: Casa de mi mamá"
                                className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-veci-secondary/50"
                            />
                        )}
                    </div>

                    <AddressAutocomplete
                        address={address}
                        comuna={comuna}
                        city={city}
                        onAddressChange={(r) => { setAddress(r.address); setComuna(r.comuna); setCity(r.city); }}
                        onManualAddressChange={setAddress}
                    />

                    <label className="block">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Indicaciones (opcional)</span>
                        <input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            maxLength={200}
                            placeholder="Ej: Depto 52, torre C, timbre no funciona"
                            className="mt-1.5 w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-veci-secondary/50"
                        />
                    </label>

                    {!isFirst && (
                        <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
                            <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="w-4 h-4 accent-pink-400" />
                            Usar como dirección predeterminada
                        </label>
                    )}

                    {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
                </div>

                <div className="mt-6 flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 py-3 rounded-full border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 rounded-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Guardar dirección
                    </button>
                </div>
            </div>
        </div>
    );
}

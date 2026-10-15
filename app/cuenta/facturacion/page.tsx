'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Save, Loader2, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRut, isValidRut } from '@/lib/rut';

/**
 * Datos de factura guardados del cliente. Se llenan solos con el primer pedido
 * con factura y precargan el checkout; la factura igual se pide pedido a pedido
 * con "Quiero factura". Ver lib/customer-invoice.ts.
 */

interface InvoiceForm {
    rut: string;
    razonSocial: string;
    giro: string;
    direccion: string;
    comuna: string;
    ciudad: string;
    email: string;
}

const EMPTY: InvoiceForm = { rut: '', razonSocial: '', giro: '', direccion: '', comuna: '', ciudad: '', email: '' };

const toForm = (data: Partial<Record<keyof InvoiceForm, string | null>>): InvoiceForm => ({
    rut: data.rut || '',
    razonSocial: data.razonSocial || '',
    giro: data.giro || '',
    direccion: data.direccion || '',
    comuna: data.comuna || '',
    ciudad: data.ciudad || '',
    email: data.email || '',
});

const inputClass = 'w-full px-4 py-3 rounded-xl border bg-white/50 text-sm focus:ring-2 focus:ring-veci-primary/20 outline-none transition-all';

export default function FacturacionPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);
    const [form, setForm] = useState<InvoiceForm>(EMPTY);

    useEffect(() => {
        if (!session?.user?.id) return;
        fetch('/api/store/customer/invoice')
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (data?.invoice) {
                    setForm(toForm(data.invoice));
                    setHasSaved(true);
                }
            })
            .catch(() => toast.error('No se pudieron cargar tus datos de facturación'))
            .finally(() => setLoading(false));
    }, [session?.user?.id]);

    const rutError = form.rut && !isValidRut(form.rut) ? 'RUT inválido' : '';

    const updateField = (field: keyof InvoiceForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = field === 'rut' ? formatRut(e.target.value) : e.target.value;
        setForm(f => ({ ...f, [field]: value }));
    };

    const handleSave = async () => {
        if (!isValidRut(form.rut)) {
            toast.error('El RUT de la factura no es válido');
            return;
        }
        if (!form.razonSocial.trim()) {
            toast.error('Ingresa la razón social');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/store/customer/invoice', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Error al guardar');
                return;
            }
            setForm(toForm(data.invoice));
            setHasSaved(true);
            toast.success('Datos de facturación guardados');
        } catch {
            toast.error('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Borrar tus datos de facturación guardados?')) return;
        setDeleting(true);
        try {
            const res = await fetch('/api/store/customer/invoice', { method: 'DELETE' });
            if (!res.ok) {
                toast.error('Error al borrar');
                return;
            }
            setForm(EMPTY);
            setHasSaved(false);
            toast.success('Datos de facturación borrados');
        } catch {
            toast.error('Error de conexión');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl">
            <h2 className="text-base sm:text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-veci-primary" /> Datos de facturación
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mb-5 sm:mb-8">
                Se precargan en el checkout cuando marcas &ldquo;Quiero factura&rdquo;. Si haces un pedido con otros datos, se
                actualizan aquí.
            </p>

            {loading ? (
                <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">RUT *</label>
                            <input type="text" value={form.rut} onChange={updateField('rut')} placeholder="76.123.456-7" maxLength={12}
                                className={`${inputClass} ${rutError ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-veci-primary'}`} />
                            {rutError && <p className="text-xs text-red-500 mt-1">{rutError}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Razón social *</label>
                            <input type="text" value={form.razonSocial} onChange={updateField('razonSocial')}
                                className={`${inputClass} border-slate-200 focus:border-veci-primary`} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Giro</label>
                            <input type="text" value={form.giro} onChange={updateField('giro')}
                                className={`${inputClass} border-slate-200 focus:border-veci-primary`} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Correo para la factura (opcional)</label>
                            <input type="email" value={form.email} onChange={updateField('email')}
                                className={`${inputClass} border-slate-200 focus:border-veci-primary`} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Dirección</label>
                            <input type="text" value={form.direccion} onChange={updateField('direccion')}
                                className={`${inputClass} border-slate-200 focus:border-veci-primary`} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Comuna</label>
                            <input type="text" value={form.comuna} onChange={updateField('comuna')}
                                className={`${inputClass} border-slate-200 focus:border-veci-primary`} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Ciudad</label>
                            <input type="text" value={form.ciudad} onChange={updateField('ciudad')}
                                className={`${inputClass} border-slate-200 focus:border-veci-primary`} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/50 flex flex-wrap items-center gap-3">
                        <button onClick={handleSave} disabled={saving || deleting}
                            className="flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar datos
                        </button>
                        {hasSaved && (
                            <button onClick={handleDelete} disabled={saving || deleting}
                                className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-70">
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Borrar datos
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

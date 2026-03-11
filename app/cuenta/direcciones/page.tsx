'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AccountSidebar } from '@/components/account/AccountSidebar';
import { MapPin, Pencil, Save, X, Loader2, Plus, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import AddressAutocomplete from '@/components/AddressAutocomplete';

interface Address {
    id: string;
    label: string;
    address: string;
    comuna: string;
    city: string;
    addressNotes: string | null;
    isDefault: boolean;
}

const emptyForm = { label: 'Casa', address: '', comuna: '', city: '', addressNotes: '' };

export default function DireccionesPage() {
    const { data: session } = useSession();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const fetchAddresses = async () => {
        try {
            const res = await fetch('/api/store/customer/addresses');
            if (res.ok) {
                setAddresses(await res.json());
            }
        } catch (error) {
            console.error('Error loading addresses:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!session?.user?.id) return;
        fetchAddresses();
    }, [session?.user?.id]);

    const startEdit = (addr: Address) => {
        setEditingId(addr.id);
        setAdding(false);
        setForm({ label: addr.label, address: addr.address, comuna: addr.comuna, city: addr.city, addressNotes: addr.addressNotes || '' });
    };

    const startAdd = () => {
        setAdding(true);
        setEditingId(null);
        setForm(emptyForm);
    };

    const cancel = () => {
        setAdding(false);
        setEditingId(null);
        setForm(emptyForm);
    };

    const handleSave = async () => {
        if (!form.address.trim() || !form.comuna.trim()) {
            toast.error('Dirección y comuna son obligatorios');
            return;
        }
        setSaving(true);
        try {
            const isEdit = !!editingId;
            const res = await fetch('/api/store/customer/addresses', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isEdit ? { id: editingId, ...form } : { ...form, isDefault: addresses.length === 0 }),
            });
            if (res.ok) {
                toast.success(isEdit ? 'Dirección actualizada' : 'Dirección agregada');
                cancel();
                await fetchAddresses();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Error al guardar');
            }
        } catch {
            toast.error('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta dirección?')) return;
        try {
            const res = await fetch(`/api/store/customer/addresses?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Dirección eliminada');
                await fetchAddresses();
            } else {
                toast.error('Error al eliminar');
            }
        } catch {
            toast.error('Error de conexión');
        }
    };

    const handleSetDefault = async (addr: Address) => {
        try {
            const res = await fetch('/api/store/customer/addresses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: addr.id, label: addr.label, address: addr.address, comuna: addr.comuna, city: addr.city, addressNotes: addr.addressNotes, isDefault: true }),
            });
            if (res.ok) {
                toast.success('Dirección predeterminada actualizada');
                await fetchAddresses();
            }
        } catch {
            toast.error('Error de conexión');
        }
    };

    const addressFormJsx = (
        <div className="space-y-4 bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la dirección</label>
                <div className="flex gap-2">
                    {['Casa', 'Trabajo', 'Otro'].map(opt => (
                        <button key={opt} type="button" onClick={() => setForm(f => ({ ...f, label: opt }))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${form.label === opt ? 'bg-veci-primary text-white shadow-md' : 'bg-white/60 text-slate-600 border border-slate-200 hover:bg-white'}`}>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
            <AddressAutocomplete
                address={form.address}
                comuna={form.comuna}
                city={form.city}
                onAddressChange={({ address, comuna, city }) => setForm(f => ({ ...f, address, comuna, city }))}
                onManualAddressChange={(address) => setForm(f => ({ ...f, address }))}
            />
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Comuna *</label>
                    <input type="text" value={form.comuna}
                        onChange={e => setForm(f => ({ ...f, comuna: e.target.value }))}
                        placeholder="Ej: Providencia"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm focus:ring-2 focus:ring-veci-primary/20 focus:border-veci-primary outline-none transition-all" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                    <input type="text" value={form.city}
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="Santiago"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm focus:ring-2 focus:ring-veci-primary/20 focus:border-veci-primary outline-none transition-all" />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas de entrega</label>
                <textarea value={form.addressNotes}
                    onChange={e => setForm(f => ({ ...f, addressNotes: e.target.value }))}
                    placeholder="Ej: Tocar el timbre 2 veces, portón negro" rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm focus:ring-2 focus:ring-veci-primary/20 focus:border-veci-primary outline-none transition-all resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-70">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                </button>
                <button onClick={cancel}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/50 text-slate-600 font-medium text-sm border border-white hover:bg-white/80 transition-colors">
                    <X className="w-4 h-4" /> Cancelar
                </button>
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-3"><AccountSidebar /></div>
            <div className="lg:col-span-9">
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Mis Direcciones</h2>
                        {!adding && !editingId && (
                            <button onClick={startAdd}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-semibold hover:bg-indigo-100 transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Agregar
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="space-y-4 animate-pulse">
                            <div className="h-20 bg-gray-100 rounded-2xl" />
                            <div className="h-20 bg-gray-100 rounded-2xl" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {adding && addressFormJsx}

                            {addresses.length === 0 && !adding ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                                        <MapPin className="w-10 h-10 text-indigo-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-2">Sin direcciones registradas</h3>
                                    <p className="text-slate-400 mb-6">Agrega una dirección para recibir pedidos más rápido</p>
                                    <button onClick={startAdd}
                                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all">
                                        Agregar dirección
                                    </button>
                                </div>
                            ) : (
                                addresses.map(addr => (
                                    editingId === addr.id ? (
                                        <div key={addr.id}>{addressFormJsx}</div>
                                    ) : (
                                        <div key={addr.id} className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-white group hover:shadow-md transition-all">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${addr.isDefault ? 'bg-veci-primary/10' : 'bg-indigo-50'}`}>
                                                    <MapPin className={`w-5 h-5 ${addr.isDefault ? 'text-veci-primary' : 'text-indigo-400'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-semibold text-slate-700">{addr.label}</p>
                                                        {addr.isDefault && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-veci-primary/10 text-veci-primary text-xs font-medium">
                                                                <Star className="w-3 h-3 fill-current" /> Predeterminada
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-600">{addr.address}</p>
                                                    <p className="text-sm text-slate-500">{[addr.comuna, addr.city].filter(Boolean).join(', ')}</p>
                                                    {addr.addressNotes && (
                                                        <p className="text-xs text-slate-400 mt-1 italic">{addr.addressNotes}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!addr.isDefault && (
                                                        <button onClick={() => handleSetDefault(addr)} title="Marcar como predeterminada"
                                                            className="p-2 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                                                            <Star className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => startEdit(addr)} title="Editar"
                                                        className="p-2 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(addr.id)} title="Eliminar"
                                                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Save, Loader2, User, Phone, FileText, Camera } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileForm {
    firstName: string;
    lastName: string;
    phone: string;
    rut: string;
}

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

export default function AjustesPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rutError, setRutError] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [form, setForm] = useState<ProfileForm>({
        firstName: '', lastName: '', phone: '', rut: '',
    });

    useEffect(() => {
        if (!session?.user?.id) return;
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/store/customer');
                if (res.ok) {
                    const data = await res.json();
                    setForm({
                        firstName: data.firstName || '',
                        lastName: data.lastName || '',
                        phone: data.phone || '',
                        rut: data.rut ? formatRut(data.rut) : '',
                    });
                    if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [session?.user?.id]);

    const handleSave = async () => {
        if (!form.firstName.trim() || !form.lastName.trim()) {
            toast.error('Nombre y apellido son obligatorios');
            return;
        }
        if (!form.phone.trim()) {
            toast.error('El teléfono es obligatorio');
            return;
        }
        if (form.rut && rutError) {
            toast.error('El RUT ingresado no es válido');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/store/customer', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                toast.success('Perfil actualizado correctamente');
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

    const updateField = (field: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(f => ({ ...f, [field]: e.target.value }));
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Formato no válido. Sube JPG, PNG o WebP.');
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            toast.error('La imagen es muy grande. Máximo 3MB.');
            return;
        }
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/store/customer/avatar', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Error al subir la foto');
                return;
            }
            setAvatarUrl(data.url);
            toast.success('Foto de perfil actualizada');
        } catch {
            toast.error('Error de conexión');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleRutChange = (value: string) => {
        const formatted = formatRut(value);
        setForm(f => ({ ...f, rut: formatted }));
        const clean = formatted.replace(/[^0-9kK]/g, '');
        if (clean.length >= 8) {
            if (!validateRut(formatted)) {
                setRutError('RUT inválido, verifica el número');
            } else {
                setRutError('');
            }
        } else {
            setRutError('');
        }
    };

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Ajustes de Cuenta</h2>
                    <p className="text-slate-500 text-sm mb-8">Actualiza tu información personal y dirección</p>

                    {loading ? (
                        <div className="space-y-4 animate-pulse">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-veci-primary to-veci-secondary p-1 shadow-lg">
                                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-3xl font-bold text-indigo-400">
                                                    {form.firstName?.charAt(0)?.toUpperCase() || '?'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        {uploadingAvatar ? (
                                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                                        ) : (
                                            <Camera className="w-6 h-6 text-white" />
                                        )}
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                            onChange={handleAvatarUpload}
                                            disabled={uploadingAvatar}
                                        />
                                    </label>
                                </div>
                                <div className="text-center sm:text-left sm:pt-2">
                                    <h3 className="text-sm font-bold text-slate-700">Foto de perfil</h3>
                                    <p className="text-xs text-slate-400 mt-1">Haz clic en la foto para cambiarla</p>
                                    <p className="text-[11px] text-slate-300 mt-0.5">JPG, PNG o WebP • Máx 3MB</p>
                                </div>
                            </div>

                            {/* Personal Info */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <User className="w-4 h-4 text-veci-primary" /> Información Personal
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Nombre *</label>
                                        <input type="text" value={form.firstName} onChange={updateField('firstName')}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm focus:ring-2 focus:ring-veci-primary/20 focus:border-veci-primary outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Apellido *</label>
                                        <input type="text" value={form.lastName} onChange={updateField('lastName')}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm focus:ring-2 focus:ring-veci-primary/20 focus:border-veci-primary outline-none transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* Contact */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-veci-primary" /> Contacto
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                                        <input type="email" value={session?.user?.email || ''} disabled
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400 cursor-not-allowed" />
                                        <p className="text-xs text-slate-400 mt-1">El email no se puede cambiar</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Teléfono *</label>
                                        <input type="tel" value={form.phone} onChange={updateField('phone')}
                                            placeholder="+56 9 1234 5678"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 text-sm focus:ring-2 focus:ring-veci-primary/20 focus:border-veci-primary outline-none transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* RUT */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-veci-primary" /> Documento
                                </h3>
                                <div className="max-w-xs">
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">RUT</label>
                                    <input type="text" value={form.rut} onChange={(e) => handleRutChange(e.target.value)}
                                        placeholder="12.345.678-9" maxLength={12}
                                        className={`w-full px-4 py-3 rounded-xl border bg-white/50 text-sm focus:ring-2 focus:ring-veci-primary/20 outline-none transition-all ${rutError ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-veci-primary'}`} />
                                    {rutError && <p className="text-xs text-red-500 mt-1">{rutError}</p>}
                                </div>
                            </div>

                            {/* Save button */}
                            <div className="pt-4 border-t border-white/50">
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Guardar cambios
                                </button>
                            </div>
                        </div>
                    )}
                </div>
    );
}

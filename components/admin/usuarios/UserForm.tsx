"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, type CreateUserFormValues, ROLES } from "@/lib/validations/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, Eye, EyeOff, ShieldCheck, Shield, Package, Truck, Palette } from "lucide-react";
import Link from "next/link";

const roleIcons: Record<string, React.ReactNode> = {
    owner: <ShieldCheck className="w-4 h-4 text-amber-600" />,
    admin: <Shield className="w-4 h-4 text-blue-600" />,
    preparacion: <Package className="w-4 h-4 text-green-600" />,
    reparto: <Truck className="w-4 h-4 text-purple-600" />,
    contenido: <Palette className="w-4 h-4 text-pink-600" />,
};

interface UserFormProps {
    currentUserRole: string;
    mode: "create" | "edit";
    defaultValues?: Partial<CreateUserFormValues> & { id?: string };
    userId?: string;
}

export function UserForm({ currentUserRole, mode, defaultValues, userId }: UserFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm<CreateUserFormValues>({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
            name: defaultValues?.name || "",
            email: defaultValues?.email || "",
            password: "",
            role: defaultValues?.role || "admin",
            active: defaultValues?.active ?? true,
        },
    });

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = form;

    const selectedRole = watch("role");
    const isActive = watch("active");

    const onSubmit = async (data: CreateUserFormValues) => {
        setIsLoading(true);
        setError("");

        try {
            const url =
                mode === "create"
                    ? "/api/admin/users"
                    : `/api/admin/users/${userId}`;

            const method = mode === "create" ? "POST" : "PUT";

            // For edit mode, don't send password if empty
            const payload = { ...data };
            if (mode === "edit" && (!payload.password || payload.password === "")) {
                delete (payload as any).password;
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json.error || "Error al guardar usuario");
                return;
            }

            router.push("/admin/usuarios");
            router.refresh();
        } catch {
            setError("Error de conexión");
        } finally {
            setIsLoading(false);
        }
    };

    const availableRoles = ROLES.filter((r) => {
        // Non-owners can't assign owner role
        if (r.value === "owner" && currentUserRole !== "owner") return false;
        return true;
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Personal Info */}
            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold">Información Personal</h3>
                    <p className="text-sm text-muted-foreground mt-1">Datos básicos del usuario.</p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre completo *</Label>
                            <Input
                                id="name"
                                placeholder="Juan Pérez"
                                {...register("name")}
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500">{errors.name.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo electrónico *</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="juan@miniveci.cl"
                                {...register("email")}
                            />
                            {errors.email && (
                                <p className="text-sm text-red-500">{errors.email.message}</p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">
                            Contraseña {mode === "edit" ? "(dejar vacío para no cambiar)" : "*"}
                        </Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder={mode === "edit" ? "••••••••" : "Mínimo 6 caracteres"}
                                {...register("password")}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {errors.password && (
                            <p className="text-sm text-red-500">{errors.password.message}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Role & Permissions */}
            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold">Rol y Permisos</h3>
                    <p className="text-sm text-muted-foreground mt-1">Define qué puede hacer este usuario en el sistema.</p>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <Label>Rol del usuario *</Label>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {availableRoles.map((role) => (
                                <button
                                    key={role.value}
                                    type="button"
                                    onClick={() => setValue("role", role.value, { shouldValidate: true })}
                                    className={`
                                        flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all
                                        ${selectedRole === role.value
                                            ? "border-slate-800 bg-slate-50 ring-1 ring-slate-800"
                                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                        }
                                    `}
                                >
                                    <div className="mt-0.5">{roleIcons[role.value]}</div>
                                    <div>
                                        <div className="font-medium text-sm">{role.label}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {errors.role && (
                            <p className="text-sm text-red-500">{errors.role.message}</p>
                        )}
                    </div>

                    {/* Role permissions detail */}
                    <div className="bg-slate-50 border rounded-lg p-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            {roleIcons[selectedRole]}
                            Permisos de {availableRoles.find((r) => r.value === selectedRole)?.label}
                        </h4>
                        <div className="grid gap-2 text-sm text-muted-foreground">
                            {selectedRole === "owner" && (
                                <>
                                    <p>✓ Acceso total a todas las funciones</p>
                                    <p>✓ Gestión de usuarios y roles</p>
                                    <p>✓ Configuración del sistema</p>
                                    <p>✓ Eliminar usuarios</p>
                                </>
                            )}
                            {selectedRole === "admin" && (
                                <>
                                    <p>✓ Gestión completa de catálogo y pedidos</p>
                                    <p>✓ Gestión de usuarios (excepto dueños)</p>
                                    <p>✓ Configuración de la tienda</p>
                                    <p>✓ Ver reportes y estadísticas</p>
                                </>
                            )}
                            {selectedRole === "preparacion" && (
                                <>
                                    <p>✓ Ver pedidos asignados</p>
                                    <p>✓ Actualizar estado de pedidos</p>
                                    <p>✓ Ver catálogo de productos</p>
                                    <p>✗ No puede editar catálogo ni configuración</p>
                                </>
                            )}
                            {selectedRole === "reparto" && (
                                <>
                                    <p>✓ Ver pedidos listos para envío</p>
                                    <p>✓ Marcar pedidos como entregados</p>
                                    <p>✓ Ver datos de envío de clientes</p>
                                    <p>✗ No puede editar catálogo ni configuración</p>
                                </>
                            )}
                            {selectedRole === "contenido" && (
                                <>
                                    <p>✓ Editar catálogo de productos</p>
                                    <p>✓ Gestionar categorías e imágenes</p>
                                    <p>✓ Editar contenido de la tienda</p>
                                    <p>✗ No puede gestionar pedidos ni usuarios</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status */}
            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold">Estado</h3>
                </div>
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="active" className="text-sm font-medium">
                                Usuario activo
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                                Los usuarios inactivos no pueden iniciar sesión en el sistema.
                            </p>
                        </div>
                        <Switch
                            id="active"
                            checked={isActive}
                            onCheckedChange={(checked) => setValue("active", checked)}
                        />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
                <Link href="/admin/usuarios">
                    <Button type="button" variant="outline" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Volver
                    </Button>
                </Link>
                <Button type="submit" disabled={isLoading} className="gap-2 min-w-[140px]">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    {mode === "create" ? "Crear Usuario" : "Guardar Cambios"}
                </Button>
            </div>
        </form>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserForm } from "@/components/admin/usuarios/UserForm";
import { Loader2 } from "lucide-react";

interface UserDetailWrapperProps {
    userId: string;
    currentUserRole: string;
    currentUserId: string;
}

interface UserData {
    id: string;
    email: string;
    name: string;
    role: string;
    active: boolean;
    avatarUrl: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export function UserDetailWrapper({ userId, currentUserRole, currentUserId }: UserDetailWrapperProps) {
    const router = useRouter();
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchUser() {
            try {
                const res = await fetch(`/api/admin/users/${userId}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setError("Usuario no encontrado");
                    } else {
                        setError("Error al cargar el usuario");
                    }
                    return;
                }
                const data = await res.json();
                setUser(data);
            } catch {
                setError("Error de conexión");
            } finally {
                setLoading(false);
            }
        }
        fetchUser();
    }, [userId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-muted-foreground">{error || "Usuario no encontrado"}</p>
            </div>
        );
    }

    const isSelf = userId === currentUserId;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Editar Usuario</h2>
                <p className="text-muted-foreground">
                    {isSelf ? "Edita tu información personal." : `Editar la cuenta de ${user.name}.`}
                </p>
            </div>

            <UserForm
                currentUserRole={currentUserRole}
                mode="edit"
                userId={userId}
                defaultValues={{
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    active: user.active,
                }}
            />
        </div>
    );
}

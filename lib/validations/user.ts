import * as z from "zod";

export const ROLES = [
    { value: "owner", label: "Dueño", description: "Acceso total a todas las funciones" },
    { value: "admin", label: "Administrador", description: "Gestión completa de la tienda" },
    { value: "preparacion", label: "Preparación", description: "Preparar y empacar pedidos" },
    { value: "reparto", label: "Reparto", description: "Gestión de envíos y entregas" },
    { value: "contenido", label: "Contenido", description: "Editar catálogo y contenido web" },
] as const;

export const roleValues = ROLES.map((r) => r.value) as [string, ...string[]];

export const createUserSchema = z.object({
    email: z.string().email("Correo electrónico inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    name: z.string().min(1, "El nombre es requerido"),
    role: z.enum(roleValues, { message: "Rol inválido" }),
    active: z.boolean().default(true),
});

export const updateUserSchema = z.object({
    email: z.string().email("Correo electrónico inválido").optional(),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional().or(z.literal("")),
    name: z.string().min(1, "El nombre es requerido").optional(),
    role: z.enum(roleValues, { message: "Rol inválido" }).optional(),
    active: z.boolean().optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

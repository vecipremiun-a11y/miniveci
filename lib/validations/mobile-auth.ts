import { z } from "zod";

export const registerSchema = z.object({
    name: z.string().min(2, "Nombre muy corto").max(80),
    email: z.string().email("Email inválido").max(120).toLowerCase(),
    password: z.string().min(8, "Mínimo 8 caracteres").max(120),
    phone: z.string().min(8).max(20).optional().nullable(),
});

export const loginSchema = z.object({
    email: z.string().email("Email inválido").toLowerCase(),
    password: z.string().min(1, "Password requerido").max(120),
});

export const refreshSchema = z.object({
    // El min es 1 — la validación real de formato/firma se hace al verificar el JWT
    // (cualquier string inválido debe devolver 401, no 422).
    refreshToken: z.string().min(1, "refreshToken requerido"),
});

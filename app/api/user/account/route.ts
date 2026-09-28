/**
 * DELETE /api/user/account — el cliente elimina su propia cuenta desde la app.
 *
 * Auth: Authorization: Bearer <accessToken> (solo clientes; las cuentas de
 * administrador se gestionan desde el panel).
 * Body: { "confirm": "ELIMINAR" }
 *
 * Respuestas:
 *  - 200 { success: true }
 *  - 400 confirmación faltante
 *  - 401/403 auth
 *  - 409 { code: "active_orders" | "active_subscription", message } — hay algo
 *    en curso; el mensaje se puede mostrar tal cual al cliente.
 *
 * Qué se borra y qué se anonimiza: lib/delete-customer-account.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractBearer, verifyAccessToken, AuthHttpError } from "@/lib/mobile-auth";
import { AccountDeletionBlockedError, deleteCustomerAccount } from "@/lib/delete-customer-account";

export async function DELETE(req: NextRequest) {
    const token = extractBearer(req);
    if (!token) {
        return NextResponse.json({ message: "Falta Authorization", code: "missing_token" }, { status: 401 });
    }

    let userId: string;
    try {
        const payload = await verifyAccessToken(token);
        if (payload.userType !== "customer") {
            return NextResponse.json(
                { message: "Las cuentas de administrador no se eliminan desde la app", code: "forbidden" },
                { status: 403 },
            );
        }
        userId = payload.sub;
    } catch (err) {
        if (err instanceof AuthHttpError) {
            return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
        }
        return NextResponse.json({ message: "Token inválido", code: "invalid_token" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "ELIMINAR") {
        return NextResponse.json({ message: "Confirmación requerida", code: "confirm_required" }, { status: 400 });
    }

    try {
        await deleteCustomerAccount(userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AccountDeletionBlockedError) {
            return NextResponse.json({ message: error.message, code: error.code }, { status: 409 });
        }
        console.error("[ACCOUNT_DELETE_MOBILE]", error);
        return NextResponse.json({ message: "No se pudo eliminar la cuenta", code: "internal" }, { status: 500 });
    }
}

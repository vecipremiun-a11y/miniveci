import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AuthHttpError, requireUser } from "@/lib/mobile-auth";
import { adminToApiUser, customerToApiUser } from "@/lib/user-shape";

export async function GET(req: NextRequest) {
    try {
        const authed = await requireUser(req);
        if (authed.userType === "admin") {
            const u = await db.query.users.findFirst({ where: eq(users.id, authed.userId) });
            if (!u || !u.active) {
                return NextResponse.json({ message: "Usuario no encontrado", code: "user_not_found" }, { status: 404 });
            }
            return NextResponse.json(adminToApiUser(u));
        }
        const c = await db.query.customers.findFirst({ where: eq(customers.id, authed.userId) });
        if (!c || !c.active) {
            return NextResponse.json({ message: "Usuario no encontrado", code: "user_not_found" }, { status: 404 });
        }
        return NextResponse.json(customerToApiUser(c));
    } catch (error: any) {
        if (error instanceof AuthHttpError) {
            return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
        }
        console.error("[AUTH_ME]", error);
        return NextResponse.json({ message: "Error interno", code: "internal_error" }, { status: 500 });
    }
}

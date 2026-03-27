import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 3 * 1024 * 1024; // 3MB

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: "Formato no válido. Sube JPG, PNG o WebP." },
                { status: 400 }
            );
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: "El archivo es muy grande. Máximo 3MB." },
                { status: 400 }
            );
        }

        const ext = file.name.split(".").pop() || "jpg";
        const filename = `avatars/${session.user.id}-${Date.now()}.${ext}`;

        const blob = await put(filename, file, {
            access: "public",
            addRandomSuffix: true,
        });

        // Update customer avatar in DB
        await db.update(customers).set({
            avatarUrl: blob.url,
            updatedAt: new Date().toISOString(),
        }).where(eq(customers.id, session.user.id));

        return NextResponse.json({ url: blob.url });
    } catch (error) {
        console.error("[AVATAR_UPLOAD]", error);
        return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
    }
}

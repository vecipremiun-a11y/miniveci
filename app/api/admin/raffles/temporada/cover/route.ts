import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth, AuthError } from "@/lib/auth-utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024;

/** Sube la imagen de fondo del sorteo de temporada a Vercel Blob y devuelve su URL.
 *  No toca la DB — el PUT de /api/admin/raffles/temporada persiste la URL en coverImage. */
export async function POST(req: NextRequest) {
    try {
        await requireAuth();

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "Formato no válido. Sube JPG, PNG, WebP o AVIF." }, { status: 400 });
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "El archivo es muy grande. Máximo 5MB." }, { status: 400 });
        }

        const ext = file.name.split(".").pop() || "jpg";
        const filename = `raffles/temporada-fondo-${Date.now()}.${ext}`;
        const blob = await put(filename, file, { access: "public", addRandomSuffix: true });

        return NextResponse.json({ url: blob.url }, { status: 201 });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[RAFFLE_TEMPORADA_COVER_UPLOAD]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { raffleImages, raffles } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;

        const raffle = await db.query.raffles.findFirst({
            where: eq(raffles.id, id),
            columns: { id: true, slug: true },
        });
        if (!raffle) {
            return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
        }

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
        const filename = `raffles/${raffle.slug}-${Date.now()}.${ext}`;
        const blob = await put(filename, file, { access: "public", addRandomSuffix: true });

        const existing = await db.select({ id: raffleImages.id }).from(raffleImages).where(eq(raffleImages.raffleId, id));
        const isPrimary = existing.length === 0;

        if (isPrimary) {
            // Si es la primera, también ponerla como coverImage del sorteo
            await db.update(raffles).set({ coverImage: blob.url, updatedAt: new Date().toISOString() }).where(eq(raffles.id, id));
        }

        const newImage = await db.insert(raffleImages).values({
            id: crypto.randomUUID(),
            raffleId: id,
            url: blob.url,
            position: existing.length,
            isPrimary,
        }).returning();

        return NextResponse.json(newImage[0], { status: 201 });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[RAFFLE_IMAGE_UPLOAD]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

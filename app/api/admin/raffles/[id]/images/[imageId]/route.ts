import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffleImages, raffles } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { and, eq } from "drizzle-orm";

// Marcar como principal
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    try {
        await requireAuth();
        const { id, imageId } = await params;

        const image = await db.query.raffleImages.findFirst({
            where: and(eq(raffleImages.id, imageId), eq(raffleImages.raffleId, id)),
        });
        if (!image) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

        await db.update(raffleImages).set({ isPrimary: false }).where(eq(raffleImages.raffleId, id));
        await db.update(raffleImages).set({ isPrimary: true }).where(eq(raffleImages.id, imageId));
        await db.update(raffles)
            .set({ coverImage: image.url, updatedAt: new Date().toISOString() })
            .where(eq(raffles.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("[RAFFLE_IMAGE_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    try {
        await requireAuth();
        const { id, imageId } = await params;

        const image = await db.query.raffleImages.findFirst({
            where: and(eq(raffleImages.id, imageId), eq(raffleImages.raffleId, id)),
        });
        if (!image) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

        await db.delete(raffleImages).where(eq(raffleImages.id, imageId));

        // Si era la principal, promover otra
        if (image.isPrimary) {
            const remaining = await db.select().from(raffleImages)
                .where(eq(raffleImages.raffleId, id))
                .orderBy(raffleImages.position)
                .limit(1);
            if (remaining[0]) {
                await db.update(raffleImages).set({ isPrimary: true }).where(eq(raffleImages.id, remaining[0].id));
                await db.update(raffles)
                    .set({ coverImage: remaining[0].url, updatedAt: new Date().toISOString() })
                    .where(eq(raffles.id, id));
            } else {
                await db.update(raffles)
                    .set({ coverImage: null, updatedAt: new Date().toISOString() })
                    .where(eq(raffles.id, id));
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("[RAFFLE_IMAGE_DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

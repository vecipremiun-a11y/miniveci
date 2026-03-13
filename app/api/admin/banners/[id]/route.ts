import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { banners } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, context: any) {
  try {
    await requireAuth();
    const { id } = await context.params;

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.linkUrl !== undefined) updates.linkUrl = body.linkUrl;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const updated = await db
      .update(banners)
      .set(updates)
      .where(eq(banners.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: "Banner no encontrado" }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("[ADMIN_BANNER_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: any) {
  try {
    await requireAuth();
    const { id } = await context.params;

    const banner = await db.select().from(banners).where(eq(banners.id, id));
    if (banner.length === 0) {
      return NextResponse.json({ error: "Banner no encontrado" }, { status: 404 });
    }

    // Delete from Vercel Blob
    try {
      await del(banner[0].imageUrl);
    } catch {
      // Blob may already be deleted, continue
    }

    await db.delete(banners).where(eq(banners.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_BANNER_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

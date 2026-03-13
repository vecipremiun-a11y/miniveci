import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { banners } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { asc } from "drizzle-orm";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function GET() {
  try {
    await requireAuth();
    const allBanners = await db
      .select()
      .from(banners)
      .orderBy(asc(banners.sortOrder));
    return NextResponse.json(allBanners);
  } catch (error) {
    console.error("[ADMIN_BANNERS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const linkUrl = formData.get("linkUrl") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no válido. Sube JPG, PNG, WebP o AVIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo es muy grande. Máximo 5MB." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `banners/${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
    });

    // Get max sort order
    const existing = await db.select().from(banners).orderBy(asc(banners.sortOrder));
    const maxSort = existing.length > 0
      ? Math.max(...existing.map((b) => b.sortOrder ?? 0))
      : -1;

    const newBanner = await db
      .insert(banners)
      .values({
        id: crypto.randomUUID(),
        title: title || null,
        imageUrl: blob.url,
        linkUrl: linkUrl || null,
        sortOrder: maxSort + 1,
        isActive: true,
      })
      .returning();

    return NextResponse.json(newBanner[0], { status: 201 });
  } catch (error) {
    console.error("[ADMIN_BANNERS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
        return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
            { error: "Formato no válido. Sube una imagen (JPG, PNG, WebP) o PDF." },
            { status: 400 }
        );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
            { error: "El archivo es muy grande. Máximo 5MB." },
            { status: 400 }
        );
    }

    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `receipts/${timestamp}.${ext}`;

    const blob = await put(filename, file, {
        access: "public",
        addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
}

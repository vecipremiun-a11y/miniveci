import { NextResponse } from "next/server";
import { loadBakeryConfig } from "@/lib/bakery";

export async function GET() {
    try {
        const cfg = await loadBakeryConfig();
        // Solo info pública: nada administrativo. Hoy todos los campos son OK para el cliente.
        return NextResponse.json(cfg);
    } catch (error) {
        console.error("[BAKERY_CONFIG_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

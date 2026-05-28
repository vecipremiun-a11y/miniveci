import { NextRequest, NextResponse } from "next/server";
import { availableSlotsForDate, loadBakeryConfig } from "@/lib/bakery";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date");
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json({ message: "date requerida en formato YYYY-MM-DD" }, { status: 400 });
        }
        const cfg = await loadBakeryConfig();
        // Anticipación del carrito (máximo lead time de sus productos). El server
        // toma el máximo con el general — nunca permite ir más rápido que el general.
        const leadHours = parseInt(searchParams.get("leadHours") || "0", 10) || 0;
        const effMin = Math.max(cfg.minHoursAhead, leadHours);
        const result = availableSlotsForDate(date, { ...cfg, minHoursAhead: effMin });
        if (!result.ok) {
            return NextResponse.json({ message: result.reason, slots: [] }, { status: 400 });
        }
        return NextResponse.json({ slots: result.slots });
    } catch (error) {
        console.error("[BAKERY_AVAILABILITY_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

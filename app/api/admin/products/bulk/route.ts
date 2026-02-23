import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { inArray } from "drizzle-orm";
import * as z from "zod";

const bulkActionSchema = z.object({
    ids: z.array(z.string()).min(1, "Debe seleccionar al menos un producto"),
    action: z.enum(["publish", "unpublish", "delete", "change_category"]),
    categoryId: z.string().optional(),
}).refine(data => {
    if (data.action === "change_category" && !data.categoryId) {
        return false;
    }
    return true;
}, "La categoría es requerida para esta acción");

export async function PUT(req: NextRequest) {
    try {
        await requireAuth();
        const body = await req.json();

        const validatedData = bulkActionSchema.parse(body);
        const { ids, action, categoryId } = validatedData;

        if (action === "delete") {
            // Delete operation
            await db.delete(products).where(inArray(products.id, ids));
            return NextResponse.json({ message: "Productos eliminados exitosamente" });

        } else if (action === "publish" || action === "unpublish") {
            // Publish/Unpublish operation
            const isPublished = action === "publish";
            await db.update(products)
                .set({ isPublished, updatedAt: new Date().toISOString() })
                .where(inArray(products.id, ids));

            return NextResponse.json({ message: "Estado actualizado exitosamente" });

        } else if (action === "change_category") {
            // Change Category
            if (!categoryId) throw new Error("Category ID missing");
            await db.update(products)
                .set({ categoryId, updatedAt: new Date().toISOString() })
                .where(inArray(products.id, ids));

            return NextResponse.json({ message: "Categoría actualizada exitosamente" });

        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        if (error?.name === 'ZodError' || error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }
        console.error("[PRODUCTS_BULK]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

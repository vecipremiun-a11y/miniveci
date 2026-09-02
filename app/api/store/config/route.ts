import { NextResponse } from "next/server";
import { loadStoreDeliveryConfig } from "@/lib/store-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/store/config
 * Condiciones de envío para mostrar en el checkout web y en la app.
 *
 * Público: son los mismos datos que ve cualquiera al comprar. El cálculo real
 * del pedido igual se hace en el servidor, esto es solo para la vitrina.
 */
export async function GET() {
    try {
        const delivery = await loadStoreDeliveryConfig();
        return NextResponse.json(
            {
                delivery: {
                    fee: delivery.deliveryFee,
                    freeThreshold: delivery.freeDeliveryThreshold,
                    freeEnabled: delivery.freeDeliveryThreshold > 0,
                },
            },
            // Poco caché: si cambian el monto desde el admin, la tienda lo toma
            // al toque, pero sin pegarle a la base en cada carga de página.
            { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
        );
    } catch (error) {
        console.error("[STORE_CONFIG_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

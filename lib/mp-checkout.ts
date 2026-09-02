import { mpPreference } from "@/lib/mercadopago";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Construcción centralizada de preferencias de Mercado Pago para pedidos de
 * tienda. Antes cada endpoint (create-preference, retry) armaba los items y las
 * back_urls a mano; el flujo móvil directamente no creaba preferencia y el
 * pedido quedaba "pending" para siempre.
 */

export type MpLineItem = {
    title: string;
    quantity: number;
    unitPrice: number;
};

/**
 * `web`  → MP vuelve a las páginas del sitio.
 * `app`  → MP vuelve a /pago-app, que rebota al deep link miniveci://payment/...
 *          para devolver al usuario a la app Flutter.
 */
export type MpCheckoutOrigin = "web" | "app";

export type MpPreferenceResult = {
    preferenceId: string | undefined;
    initPoint: string | undefined;
    sandboxInitPoint: string | undefined;
};

export function buildMpItems(opts: {
    orderId: string;
    items: MpLineItem[];
    shippingCost?: number | null;
    discount?: number | null;
}) {
    const mpItems = opts.items.map((item) => ({
        id: opts.orderId,
        title: item.title.substring(0, 256),
        quantity: Math.max(1, Math.round(item.quantity)),
        unit_price: item.unitPrice,
        currency_id: "CLP" as const,
    }));

    if ((opts.shippingCost || 0) > 0) {
        mpItems.push({
            id: opts.orderId,
            title: "Envío a domicilio",
            quantity: 1,
            unit_price: opts.shippingCost!,
            currency_id: "CLP" as const,
        });
    }

    if ((opts.discount || 0) > 0) {
        mpItems.push({
            id: opts.orderId,
            title: "Descuento aplicado",
            quantity: 1,
            unit_price: -opts.discount!,
            currency_id: "CLP" as const,
        });
    }

    return mpItems;
}

export function buildBackUrls(orderNumber: string, origin: MpCheckoutOrigin, orderId?: string) {
    const siteUrl = getSiteUrl();
    const order = encodeURIComponent(orderNumber);

    if (origin === "app") {
        // OJO: el parámetro se llama `result`, no `status`: Mercado Pago agrega
        // sus propios `status` / `collection_status` a la back_url y pisaría el
        // nuestro.
        const base = `${siteUrl}/pago-app?order=${order}&source=store`;
        return {
            success: `${base}&result=success`,
            failure: `${base}&result=failure`,
            pending: `${base}&result=pending`,
        };
    }

    return {
        success: `${siteUrl}/pedido-exitoso?order=${order}&source=mp`,
        failure: orderId
            ? `${siteUrl}/cuenta/pedidos?id=${orderId}&error=payment_failed`
            : `${siteUrl}/checkout?error=payment_failed&order=${order}`,
        pending: `${siteUrl}/pedido-exitoso?order=${order}&source=mp&status=pending`,
    };
}

/**
 * Crea la preferencia de MP para un pedido ya persistido.
 *
 * `external_reference` = orderNumber porque es lo que el webhook
 * (/api/webhooks/mercadopago) usa para localizar el pedido y confirmarlo.
 */
export async function createOrderPreference(opts: {
    orderId: string;
    orderNumber: string;
    customerName?: string | null;
    customerLastName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    items: MpLineItem[];
    shippingCost?: number | null;
    discount?: number | null;
    origin?: MpCheckoutOrigin;
}): Promise<MpPreferenceResult> {
    const origin = opts.origin ?? "web";
    const siteUrl = getSiteUrl();
    const isHttps = siteUrl.startsWith("https");

    // Si el nombre viene completo ("Juan Pérez") y no separado, partirlo.
    let firstName = opts.customerName ?? "";
    let lastName = opts.customerLastName ?? "";
    if (!lastName && firstName.includes(" ")) {
        const parts = firstName.trim().split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
    }

    const preference = await mpPreference.create({
        body: {
            items: buildMpItems({
                orderId: opts.orderId,
                items: opts.items,
                shippingCost: opts.shippingCost,
                discount: opts.discount,
            }),
            payer: {
                name: firstName,
                surname: lastName,
                email: opts.customerEmail || "",
                phone: opts.customerPhone ? { number: opts.customerPhone } : undefined,
            },
            back_urls: buildBackUrls(opts.orderNumber, origin, opts.orderId),
            ...(isHttps ? { auto_return: "approved" as const } : {}),
            external_reference: opts.orderNumber,
            // Sin https no hay webhook posible: en local el pago nunca se
            // confirmará solo (hace falta un túnel + NEXT_PUBLIC_SITE_URL).
            notification_url: isHttps ? `${siteUrl}/api/webhooks/mercadopago` : undefined,
            statement_descriptor: "MINIVECI",
        },
    });

    return {
        preferenceId: preference.id,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
    };
}

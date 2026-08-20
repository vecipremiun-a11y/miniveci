/**
 * URL base del sitio para construir enlaces que consumen terceros
 * (`back_urls` y `notification_url` de Mercado Pago, correos, etc.).
 *
 * SEGURIDAD: nunca derivar esto de los headers `origin` / `referer` — los
 * controla el cliente, así que un atacante podía hacer que Mercado Pago
 * redirigiera a su propio dominio o mandara la notificación de pago a un
 * servidor ajeno (dejando el pedido sin confirmar). Solo configuración del
 * servidor.
 */
export function getSiteUrl(): string {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (configured) return configured.replace(/\/$/, "");

    // En dev sin variable configurada, apuntar al servidor local para que el
    // flujo de checkout siga siendo probable en la máquina del desarrollador.
    if (process.env.NODE_ENV !== "production") return "http://localhost:3000";

    return "https://miniveci.cl";
}

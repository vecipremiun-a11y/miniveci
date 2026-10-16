import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * /api/ queda bloqueada salvo las rutas públicas que usan la portada, la
 * tienda, la amasandería y los sorteos: Google renderiza esas páginas con
 * JavaScript y, sin acceso a esas APIs, las vería vacías. Google aplica la
 * regla más específica, así que el `allow` gana sobre el `disallow` de /api/.
 *
 * Login, registro, carrito y checkout no van aquí: llevan `noindex`, y Google
 * solo lo respeta si puede rastrear la página.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/api/store/", "/api/bakery/", "/api/raffles"],
                disallow: ["/admin", "/api/", "/cuenta"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}

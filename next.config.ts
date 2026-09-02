import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad.
 *
 * No se declara un CSP con `script-src` estricto porque Next inyecta scripts
 * inline para la hidratación y romperíamos la app. Se aplica lo que sí se puede
 * sin riesgo: bloquear el enmarcado (clickjacking en el panel admin), impedir el
 * sniffing de MIME, limitar el referer y cortar permisos de dispositivos.
 * `frame-ancestors` es el equivalente moderno de X-Frame-Options y
 * `upgrade-insecure-requests` fuerza https en los subrecursos.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self' https://www.mercadopago.cl https://www.mercadopago.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  // HSTS: los navegadores lo ignoran sobre http, así que es inocuo en dev.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  /**
   * C:\dev tiene varios proyectos con su propio package-lock.json, así que
   * Turbopack infiere la carpeta padre como raíz del workspace y termina
   * buscando `tailwindcss` en C:\dev. Fijar la raíz corta ese error, que en
   * desarrollo se repetía varias veces por segundo hasta dejar sin memoria al
   * servidor.
   */
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

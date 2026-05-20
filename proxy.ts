import { auth } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";

/* ----------------------- CORS ----------------------- */

// Orígenes permitidos en dev. En prod se suma NEXT_PUBLIC_SITE_URL si está
// definido + cualquier *.vercel.app.
const DEV_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5500",  // Flutter web (Live Server)
    "http://localhost:5555",  // Flutter web (flutter run -d chrome --web-port 5555)
    "http://localhost:5173",  // Vite default
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5555",
    "http://10.0.2.2:3000",   // Android emulator
];

function isAllowedOrigin(origin: string | null): boolean {
    if (!origin) return false;
    if (DEV_ALLOWED_ORIGINS.includes(origin)) return true;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && origin === siteUrl.replace(/\/$/, "")) return true;
    // Permitir cualquier subdominio *.vercel.app (preview deploys)
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
    return false;
}

function applyCorsHeaders(res: NextResponse, origin: string | null): NextResponse {
    if (origin && isAllowedOrigin(origin)) {
        res.headers.set("Access-Control-Allow-Origin", origin);
        res.headers.set("Vary", "Origin");
        res.headers.set("Access-Control-Allow-Credentials", "true");
        res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
        res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
}

function isApiPath(pathname: string): boolean {
    return pathname.startsWith("/api/");
}

/* ----------------------- Middleware ----------------------- */

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;
    const pathname = nextUrl.pathname;
    const origin = req.headers.get("origin");
    const isApi = isApiPath(pathname);

    // 1. CORS preflight: responder 204 sin tocar auth
    if (req.method === "OPTIONS" && isApi) {
        return applyCorsHeaders(new NextResponse(null, { status: 204 }), origin);
    }

    // 2. Rutas de auth de NextAuth: pasar tal cual + CORS si es API
    const isAuthRoute = pathname.startsWith("/api/auth");
    const isAdminPage = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");
    const isAdminLogin = pathname === "/admin/login";
    const isClientLogin = pathname === "/login";
    const isAccountPage = pathname.startsWith("/cuenta");

    const respond = (res: NextResponse): NextResponse => (isApi ? applyCorsHeaders(res, origin) : res);

    if (isAuthRoute) {
        return respond(NextResponse.next());
    }

    // 3. Páginas de login: redirigir si ya está logueado
    if (isClientLogin && isLoggedIn) {
        const role = req.auth?.user?.role;
        const adminRoles = ["owner", "admin", "preparacion", "reparto", "contenido"];
        if (role && adminRoles.includes(role)) {
            return NextResponse.redirect(new URL("/admin", nextUrl));
        }
        return NextResponse.redirect(new URL("/cuenta", nextUrl));
    }

    if (isAdminLogin) {
        if (isLoggedIn) return NextResponse.redirect(new URL("/admin", nextUrl));
        return NextResponse.next();
    }

    // 4. Páginas /cuenta — requieren login
    if (isAccountPage && !isLoggedIn) {
        return NextResponse.redirect(new URL("/login", nextUrl));
    }

    // 5. Páginas admin — requieren login
    if (isAdminPage && !isLoggedIn) {
        return NextResponse.redirect(new URL("/admin/login", nextUrl));
    }

    // 6. APIs admin — requieren login con sesión NextAuth (cookie).
    //    Las APIs móviles (Authorization: Bearer) usan su propio helper
    //    `requireAdmin` en cada handler, así que aquí solo bloqueamos
    //    si NO hay sesión Y NO hay Bearer token.
    if (isAdminApi && !isLoggedIn) {
        const hasBearer = (req.headers.get("authorization") || "").toLowerCase().startsWith("bearer ");
        if (!hasBearer) {
            return respond(NextResponse.json({ message: "Unauthorized" }, { status: 401 }));
        }
        // si trae Bearer, dejamos pasar para que el handler verifique JWT
    }

    // 7. Role check: rutas admin requieren rol admin
    if ((isAdminPage || isAdminApi) && isLoggedIn) {
        const role = req.auth?.user?.role;
        const adminRoles = ["owner", "admin", "preparacion", "reparto", "contenido"];
        if (role && !adminRoles.includes(role)) {
            if (isAdminApi) return respond(NextResponse.json({ message: "Forbidden" }, { status: 403 }));
            return NextResponse.redirect(new URL("/cuenta", nextUrl));
        }
    }

    return respond(NextResponse.next());
});

export const config = {
    // Incluye todas las rutas /api/* para que CORS funcione globalmente.
    // Las rutas no listadas (páginas públicas, _next, assets) no necesitan middleware.
    matcher: [
        "/admin/:path*",
        "/api/:path*",
        "/cuenta/:path*",
        "/login",
    ],
};

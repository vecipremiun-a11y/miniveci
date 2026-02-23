import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;
    const isAuthRoute = nextUrl.pathname.startsWith("/api/auth");
    const isAdminPage = nextUrl.pathname.startsWith("/admin");
    const isAdminApi = nextUrl.pathname.startsWith("/api/admin");
    const isAdminLogin = nextUrl.pathname === "/admin/login";
    const isClientLogin = nextUrl.pathname === "/login";
    const isAccountPage = nextUrl.pathname.startsWith("/cuenta");

    // Always allow NextAuth API routes
    if (isAuthRoute) {
        return NextResponse.next();
    }

    // Login pages: redirect if already logged in
    if (isClientLogin && isLoggedIn) {
        const role = req.auth?.user?.role;
        const adminRoles = ["owner", "admin", "preparacion", "reparto", "contenido"];
        if (role && adminRoles.includes(role)) {
            return NextResponse.redirect(new URL("/admin", nextUrl));
        }
        return NextResponse.redirect(new URL("/cuenta", nextUrl));
    }

    if (isAdminLogin) {
        if (isLoggedIn) {
            return NextResponse.redirect(new URL("/admin", nextUrl));
        }
        return NextResponse.next();
    }

    // Protect /cuenta — require login
    if (isAccountPage && !isLoggedIn) {
        return NextResponse.redirect(new URL("/login", nextUrl));
    }

    // Protect admin pages — require login
    if (isAdminPage && !isLoggedIn) {
        return NextResponse.redirect(new URL("/admin/login", nextUrl));
    }

    // Protect admin API routes — require login, return 401 JSON
    if (isAdminApi && !isLoggedIn) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: admin pages & API require admin-level roles
    if ((isAdminPage || isAdminApi) && isLoggedIn) {
        const role = req.auth?.user?.role;
        const adminRoles = ["owner", "admin", "preparacion", "reparto", "contenido"];
        if (role && !adminRoles.includes(role)) {
            if (isAdminApi) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/cuenta", nextUrl));
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*", "/api/auth/:path*", "/cuenta/:path*", "/login"],
};

/**
 * Smoke test del flujo de auth móvil contra el dev server.
 *
 *   node scripts/test-mobile-auth.mjs
 *
 * Cubre:
 *  - register con email único OK + tokens válidos
 *  - register con email duplicado → 409
 *  - login con credenciales correctas → tokens + user
 *  - login con password incorrecta → 401
 *  - GET /api/auth/me con access token → user
 *  - GET /api/auth/me sin token → 401
 *  - GET /api/auth/me con token roto → 401
 *  - refresh rota correctamente (revoca el anterior y emite uno nuevo)
 *  - refresh con token ya rotado → 401
 *  - access token bypass (firmar con secret distinto) → 401
 */
import { SignJWT } from "jose";
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const SECRET_RAW = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";

let pass = 0;
let fail = 0;
const log = (ok, msg, extra) => {
    if (ok) { pass++; console.log(`  ✓ ${msg}`); }
    else { fail++; console.log(`  ✗ ${msg}`, extra ?? ""); }
};

async function req(method, path, { body, token } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data };
}

async function main() {
    const stamp = Date.now();
    const email = `mob_test_${stamp}@miniveci.test`;
    const password = "Secret123!";
    const name = "Test Mobile";

    console.log("─── register ───");
    let r = await req("POST", "/api/auth/mobile/register", {
        body: { name, email, password, phone: "+56912345678" },
    });
    log(r.status === 201 && r.data?.accessToken && r.data?.refreshToken && r.data?.user?.id, "register 201 + tokens + user");
    log(r.data?.user?.role === "customer", "register devuelve role customer");
    log(r.data?.user?.email === email, "register email coincide");

    const customerId = r.data?.user?.id;
    let accessToken = r.data?.accessToken;
    let refreshToken = r.data?.refreshToken;

    console.log("\n─── register email duplicado ───");
    r = await req("POST", "/api/auth/mobile/register", {
        body: { name, email, password, phone: "+56911111111" },
    });
    log(r.status === 409, `email duplicado → 409 (got ${r.status})`);

    console.log("\n─── login OK ───");
    r = await req("POST", "/api/auth/mobile/login", { body: { email, password } });
    log(r.status === 200 && r.data?.accessToken && r.data?.refreshToken, "login 200 + tokens");
    log(r.data?.user?.id === customerId, "login devuelve mismo user.id");
    accessToken = r.data?.accessToken;
    refreshToken = r.data?.refreshToken;

    console.log("\n─── login password incorrecta ───");
    r = await req("POST", "/api/auth/mobile/login", { body: { email, password: "wrong" } });
    log(r.status === 401, `password incorrecta → 401 (got ${r.status})`);

    console.log("\n─── login email no existe ───");
    r = await req("POST", "/api/auth/mobile/login", { body: { email: `nope_${stamp}@miniveci.test`, password } });
    log(r.status === 401, `email inexistente → 401 (got ${r.status})`);

    console.log("\n─── /me con access token ───");
    r = await req("GET", "/api/auth/me", { token: accessToken });
    log(r.status === 200 && r.data?.id === customerId, "/me 200 con user correcto");
    log(r.data?.role === "customer", "/me devuelve role normalizado");

    console.log("\n─── /me sin token ───");
    r = await req("GET", "/api/auth/me");
    log(r.status === 401, `/me sin token → 401 (got ${r.status})`);

    console.log("\n─── /me con token basura ───");
    r = await req("GET", "/api/auth/me", { token: "not.a.jwt" });
    log(r.status === 401, `/me con token inválido → 401 (got ${r.status})`);

    console.log("\n─── /me con token firmado con otro secret ───");
    if (SECRET_RAW) {
        const fake = await new SignJWT({ email, role: "customer", userType: "customer" })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(customerId)
            .setIssuedAt()
            .setExpirationTime("15m")
            .sign(new TextEncoder().encode("otro-secret-diferente"));
        r = await req("GET", "/api/auth/me", { token: fake });
        log(r.status === 401, `firma con otro secret → 401 (got ${r.status})`);
    }

    console.log("\n─── /me con access token expirado ───");
    if (SECRET_RAW) {
        const past = Math.floor(Date.now() / 1000) - 600;
        const expired = await new SignJWT({ email, role: "customer", userType: "customer" })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(customerId)
            .setIssuedAt(past)
            .setExpirationTime(past + 60) // expiró hace 9 min
            .sign(new TextEncoder().encode(SECRET_RAW));
        r = await req("GET", "/api/auth/me", { token: expired });
        log(r.status === 401 && r.data?.code === "token_expired", `expired → 401 con code token_expired (got ${r.status}/${r.data?.code})`);
    }

    console.log("\n─── refresh rota tokens ───");
    r = await req("POST", "/api/auth/mobile/refresh", { body: { refreshToken } });
    log(r.status === 200 && r.data?.accessToken && r.data?.refreshToken, "refresh 200 + nuevos tokens");
    log(r.data?.refreshToken !== refreshToken, "refresh devuelve refreshToken distinto (rotación)");
    const newAccess = r.data?.accessToken;
    const newRefresh = r.data?.refreshToken;

    console.log("\n─── access token nuevo funciona ───");
    r = await req("GET", "/api/auth/me", { token: newAccess });
    log(r.status === 200 && r.data?.id === customerId, "nuevo access token vale en /me");

    console.log("\n─── refresh token viejo ya no sirve ───");
    r = await req("POST", "/api/auth/mobile/refresh", { body: { refreshToken } });
    log(r.status === 401, `refresh anterior → 401 tras rotación (got ${r.status})`);

    console.log("\n─── refresh con token basura ───");
    r = await req("POST", "/api/auth/mobile/refresh", { body: { refreshToken: "garbage" } });
    log(r.status === 401, `refresh basura → 401 (got ${r.status})`);

    console.log("\n─── nuevo refresh funciona ───");
    r = await req("POST", "/api/auth/mobile/refresh", { body: { refreshToken: newRefresh } });
    log(r.status === 200, `nuevo refresh OK (got ${r.status})`);

    console.log(`\nResultado: ${pass} pass / ${fail} fail`);
    process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("Test crashed:", e); process.exit(1); });

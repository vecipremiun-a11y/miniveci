/**
 * Verifica idTokens emitidos por Google Sign-In contra las llaves públicas
 * de Google (con cache automático).
 *
 * Usado por:
 *  - POST /api/auth/mobile/google (Flutter app manda idToken)
 *
 * El SDK de Google Sign-In en Android entrega tokens con el Web Client ID
 * como `aud`, NO con el Android Client ID. Validamos contra el Web Client ID.
 */
import { OAuth2Client } from "google-auth-library";

export interface GoogleIdTokenPayload {
    sub: string;          // ID único de Google del usuario
    email: string;
    name: string;
    picture: string | null;
    emailVerified: boolean;
}

// Instancia única — internamente cachea las llaves públicas de Google.
let client: OAuth2Client | null = null;
function getClient(): OAuth2Client | null {
    const audience = process.env.GOOGLE_OAUTH_WEB_CLIENT_ID;
    if (!audience) {
        console.warn("[google-auth] GOOGLE_OAUTH_WEB_CLIENT_ID no configurado");
        return null;
    }
    if (!client) {
        client = new OAuth2Client(audience);
    }
    return client;
}

export class GoogleAuthError extends Error {
    public code: "invalid_token" | "email_not_verified" | "not_configured";
    constructor(code: GoogleAuthError["code"], message: string) {
        super(message);
        this.code = code;
    }
}

/**
 * Valida firma, audience, expiración, e issuer. Lanza GoogleAuthError si algo falla.
 * Si la env var no está configurada, también falla — el endpoint debe responder 500.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
    const c = getClient();
    if (!c) throw new GoogleAuthError("not_configured", "GOOGLE_OAUTH_WEB_CLIENT_ID no configurado");

    let ticket;
    try {
        ticket = await c.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_OAUTH_WEB_CLIENT_ID!,
        });
    } catch (err) {
        throw new GoogleAuthError("invalid_token", (err as Error).message || "idToken inválido");
    }

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
        throw new GoogleAuthError("invalid_token", "payload sin sub/email");
    }
    if (!payload.email_verified) {
        throw new GoogleAuthError("email_not_verified", "Google no verificó este email");
    }
    // issuer check (google-auth-library ya lo hace, pero por defensa en profundidad)
    const validIssuers = new Set(["accounts.google.com", "https://accounts.google.com"]);
    if (payload.iss && !validIssuers.has(payload.iss)) {
        throw new GoogleAuthError("invalid_token", `issuer inválido: ${payload.iss}`);
    }

    return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        name: payload.name || payload.email.split("@")[0],
        picture: payload.picture ?? null,
        emailVerified: true,
    };
}

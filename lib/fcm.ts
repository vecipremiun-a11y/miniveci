/**
 * Firebase Cloud Messaging — wrapper para enviar push notifications
 * a clientes de la app Flutter.
 *
 * Setup:
 *  1. En Firebase Console → Settings → Service accounts → Generate private key
 *  2. Pega el JSON completo en env var FIREBASE_SERVICE_ACCOUNT (single line)
 *  3. Listo, esta lib lo lee al primer uso e inicializa firebase-admin
 *
 * Si la env var no está, las funciones no fallan — solo loggean y siguen.
 */

import admin from "firebase-admin";
import { db } from "@/lib/db";
import { userPushTokens } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

// --- Init lazy ---

declare global {
    // eslint-disable-next-line no-var
    var __fcmApp: admin.app.App | null | undefined;
}

function getApp(): admin.app.App | null {
    if (globalThis.__fcmApp !== undefined) return globalThis.__fcmApp;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
        console.log("[FCM] FIREBASE_SERVICE_ACCOUNT no configurado — push deshabilitado");
        globalThis.__fcmApp = null;
        return null;
    }

    try {
        const parsed = JSON.parse(raw);
        // Si ya hay apps inicializadas (HMR de dev), reusar la default
        const existing = admin.apps.find((a) => a?.name === "[DEFAULT]");
        const app = existing ?? admin.initializeApp({ credential: admin.credential.cert(parsed) });
        globalThis.__fcmApp = app;
        console.log("[FCM] firebase-admin inicializado");
        return app;
    } catch (err) {
        console.error("[FCM] Error parseando/inicializando FIREBASE_SERVICE_ACCOUNT:", (err as Error).message);
        globalThis.__fcmApp = null;
        return null;
    }
}

// --- Send to user (multi-device) ---

export interface PushPayload {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}

/**
 * Envía push a TODOS los tokens activos del userId.
 * Fire-and-forget desde el caller: NO bloquea, NO throw, solo loggea.
 * Limpia automáticamente tokens inválidos (uninstall, expirados).
 */
export async function sendPushToUser({ userId, title, body, data }: PushPayload): Promise<void> {
    const app = getApp();
    if (!app) return;

    let tokens: { id: string; token: string }[] = [];
    try {
        tokens = await db
            .select({ id: userPushTokens.id, token: userPushTokens.token })
            .from(userPushTokens)
            .where(eq(userPushTokens.userId, userId));
    } catch (err) {
        console.error("[FCM] Error leyendo tokens:", (err as Error).message);
        return;
    }

    if (tokens.length === 0) {
        console.log(`[FCM] Sin tokens para user ${userId.slice(0, 8)}... — skip`);
        return;
    }

    try {
        const res = await admin.messaging(app).sendEachForMulticast({
            tokens: tokens.map((t) => t.token),
            notification: { title, body },
            data: data ?? {},
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    channelId: "miniveci_orders",
                },
            },
        });

        // Limpiar tokens inválidos
        const invalidTokenIds: string[] = [];
        res.responses.forEach((r, i) => {
            if (!r.success) {
                const code = r.error?.code ?? "";
                if (
                    code === "messaging/registration-token-not-registered" ||
                    code === "messaging/invalid-registration-token" ||
                    code === "messaging/invalid-argument"
                ) {
                    invalidTokenIds.push(tokens[i].id);
                } else {
                    console.warn(`[FCM] Error en token ${tokens[i].token.slice(0, 12)}...:`, code);
                }
            }
        });

        if (invalidTokenIds.length > 0) {
            await db.delete(userPushTokens).where(inArray(userPushTokens.id, invalidTokenIds));
            console.log(`[FCM] Limpiados ${invalidTokenIds.length} tokens inválidos para user ${userId.slice(0, 8)}...`);
        }

        console.log(
            `[FCM] push user=${userId.slice(0, 8)}... ${res.successCount}/${tokens.length} OK · "${title}"`,
        );
    } catch (err) {
        console.error("[FCM] sendEachForMulticast falló:", (err as Error).message);
    }
}

// --- Templates de notificaciones por estado ---

export type OrderSource = "bakery" | "store";

interface Template {
    title: string;
    body: string;
}

/**
 * Plantilla de mensaje según estado + tipo. Devuelve null si no hay
 * plantilla configurada para ese estado (ej: estados internos como "paid").
 */
export function templateForOrderStatus(
    status: string,
    source: OrderSource,
    publicCode: string,
): Template | null {
    const orderWord = source === "bakery" ? "encargo" : "pedido";

    switch (status) {
        case "new":
        case "pending":
            return {
                title: `Recibimos tu ${orderWord} ${publicCode} 🎉`,
                body: "Lo vamos a revisar y te avisamos cuando avancemos.",
            };
        case "confirmed":
            return {
                title: `Confirmamos tu ${orderWord} ${publicCode} ✓`,
                body: "Pronto empezamos a prepararlo.",
            };
        case "preparing":
            return {
                title: `Preparando ${publicCode} 👨‍🍳`,
                body: source === "bakery"
                    ? "El panadero ya está trabajando en tu encargo."
                    : "Estamos preparando tu pedido.",
            };
        case "ready":
            return {
                title: `${publicCode} está listo 📦`,
                body: source === "bakery" ? "Pasa a retirarlo cuando puedas." : "Listo para retirar o despachar.",
            };
        case "out_for_delivery":
            return {
                title: `${publicCode} va en camino 🛵`,
                body: "Tu pedido salió a reparto, llega pronto.",
            };
        case "shipped":
            return {
                title: `${publicCode} en camino 🚚`,
                body: "Tu pedido fue despachado, llega pronto.",
            };
        case "delivered":
            return {
                title: `${publicCode} fue entregado 🙏`,
                body: "¡Gracias por elegirnos!",
            };
        case "cancelled":
        case "canceled":
            return {
                title: `${publicCode} cancelado`,
                body: `Tu ${orderWord} fue cancelado. Si tienes dudas, contáctanos.`,
            };
        default:
            return null;
    }
}

/**
 * Helper combinado: dispara push si hay plantilla para el estado.
 * NO espera resultado (fire-and-forget desde el caller).
 */
export async function notifyOrderStatusChanged(opts: {
    userId: string | null | undefined;
    status: string;
    source: OrderSource;
    publicCode: string;
    orderId: string;
}): Promise<void> {
    if (!opts.userId) return;
    const t = templateForOrderStatus(opts.status, opts.source, opts.publicCode);
    if (!t) return;
    await sendPushToUser({
        userId: opts.userId,
        title: t.title,
        body: t.body,
        data: {
            orderId: opts.orderId,
            source: opts.source,
            status: opts.status,
            deepLink: `miniveci://order/${opts.orderId}`,
        },
    });
}

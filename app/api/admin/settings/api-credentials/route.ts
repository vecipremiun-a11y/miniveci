import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiCredentials } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
    regenerate: z.boolean().optional(),
    posWebhookUrl: z.string().url("URL inválida").optional(),
    webhookSecret: z.string().min(1, "Webhook Secret requerido").optional(),
});

function generateClientId() {
    return `mvc_${crypto.randomUUID().replace(/-/g, "")}`;
}

function generateClientSecret() {
    const a = crypto.randomUUID().replace(/-/g, "");
    const b = crypto.randomUUID().replace(/-/g, "");
    return `mvs_${a}${b}`;
}

export async function GET() {
    try {
        const session = await requireAuth();

        if (!session?.user?.role || !["owner", "admin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const credentials = await db.query.apiCredentials.findFirst({
            where: eq(apiCredentials.id, "main"),
        });

        return NextResponse.json({
            clientId: credentials?.clientId ?? "",
            posWebhookUrl: credentials?.posWebhookUrl ?? "",
            webhookSecret: credentials?.webhookSecret ?? "",
            hasCredentials: Boolean(credentials?.clientId && credentials?.clientSecret),
        });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.error("[API_CREDENTIALS_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth();

        if (!session?.user?.role || !["owner", "admin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { regenerate = false, posWebhookUrl, webhookSecret } = updateSchema.parse(body);

        if (!regenerate && posWebhookUrl === undefined && webhookSecret === undefined) {
            return NextResponse.json({ error: "No hay cambios para guardar" }, { status: 400 });
        }

        const existing = await db.query.apiCredentials.findFirst({
            where: eq(apiCredentials.id, "main"),
        });

        const clientId = regenerate ? generateClientId() : existing?.clientId ?? generateClientId();
        const clientSecret = regenerate ? generateClientSecret() : existing?.clientSecret ?? generateClientSecret();
        const webhookUrlToSave = posWebhookUrl ?? existing?.posWebhookUrl ?? "";
        const webhookSecretToSave = webhookSecret ?? existing?.webhookSecret ?? "";

        await db.insert(apiCredentials)
            .values({
                id: "main",
                clientId,
                clientSecret,
                posWebhookUrl: webhookUrlToSave,
                webhookSecret: webhookSecretToSave,
            })
            .onConflictDoUpdate({
                target: apiCredentials.id,
                set: {
                    clientId,
                    clientSecret,
                    posWebhookUrl: webhookUrlToSave,
                    webhookSecret: webhookSecretToSave,
                },
            });

        return NextResponse.json({
            success: true,
            clientId,
            posWebhookUrl: webhookUrlToSave,
            webhookSecret: webhookSecretToSave,
            generatedClientSecret: regenerate ? clientSecret : undefined,
        });
    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error?.name === "ZodError") {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }

        console.error("[API_CREDENTIALS_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

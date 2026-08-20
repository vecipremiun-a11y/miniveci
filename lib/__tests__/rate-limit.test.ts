import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp } from "../rate-limit";

const rule = { name: "test", limit: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
    beforeEach(() => {
        globalThis.__miniveciRateLimitBuckets = new Map();
    });

    it("permite hasta el límite y bloquea después", () => {
        expect(checkRateLimit(rule, "ip-a").allowed).toBe(true);
        expect(checkRateLimit(rule, "ip-a").allowed).toBe(true);
        expect(checkRateLimit(rule, "ip-a").allowed).toBe(true);
        expect(checkRateLimit(rule, "ip-a").allowed).toBe(false);
    });

    it("lleva contadores independientes por identificador", () => {
        for (let i = 0; i < 3; i++) checkRateLimit(rule, "ip-a");
        expect(checkRateLimit(rule, "ip-a").allowed).toBe(false);
        expect(checkRateLimit(rule, "ip-b").allowed).toBe(true);
    });

    it("no mezcla buckets de reglas distintas", () => {
        for (let i = 0; i < 3; i++) checkRateLimit(rule, "ip-a");
        expect(checkRateLimit({ ...rule, name: "otra" }, "ip-a").allowed).toBe(true);
    });

    it("informa cuántos segundos faltan al bloquear", () => {
        for (let i = 0; i < 3; i++) checkRateLimit(rule, "ip-a");
        const blocked = checkRateLimit(rule, "ip-a");
        expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
        expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it("reabre la ventana una vez expirada", () => {
        const shortRule = { name: "corta", limit: 1, windowMs: 1 };
        expect(checkRateLimit(shortRule, "ip-a").allowed).toBe(true);
        // Fuerza la expiración manipulando el resetAt del bucket.
        const buckets = globalThis.__miniveciRateLimitBuckets!;
        const key = "corta:ip-a";
        buckets.set(key, { count: 99, resetAt: Date.now() - 1 });
        expect(checkRateLimit(shortRule, "ip-a").allowed).toBe(true);
    });
});

describe("getClientIp", () => {
    it("toma el primer valor de x-forwarded-for", () => {
        const req = new Request("http://x", {
            headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" },
        });
        expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("cae a x-real-ip", () => {
        const req = new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } });
        expect(getClientIp(req)).toBe("9.9.9.9");
    });

    it("devuelve 'unknown' sin cabeceras de proxy", () => {
        expect(getClientIp(new Request("http://x"))).toBe("unknown");
    });
});

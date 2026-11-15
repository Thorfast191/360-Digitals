import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hasTestDb } from "@/test/db";
import { clientIp } from "./rate-limit";

describe("clientIp", () => {
  it("prefers X-Real-IP set by Nginx", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.7");
  });

  it("uses the LAST X-Forwarded-For hop, ignoring client-supplied entries", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to a shared bucket when no proxy header is present", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe.skipIf(!hasTestDb)("hitRateLimit (Postgres)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { hitRateLimit, clearRateLimit } = await import("./rate-limit");
  const key = `test:${process.pid}`;

  beforeEach(() => clearRateLimit(key));
  afterAll(async () => {
    await clearRateLimit(key);
    await prisma.$disconnect();
  });

  it("allows up to the limit, then blocks with a Retry-After", async () => {
    for (let i = 1; i <= 3; i++) expect((await hitRateLimit(key, 3, 60)).ok).toBe(true);
    const blocked = await hitRateLimit(key, 3, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts every concurrent hit exactly once", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => hitRateLimit(key, 5, 60)));
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });

  it("starts a fresh window once the old one expires", async () => {
    await hitRateLimit(key, 1, 1);
    expect((await hitRateLimit(key, 1, 1)).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 1100));
    expect((await hitRateLimit(key, 1, 1)).ok).toBe(true);
  });
});

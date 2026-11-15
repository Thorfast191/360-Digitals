import { prisma } from "@/lib/prisma";

/**
 * Fixed-window counter stored in Postgres (audit F-02 / F-04). One atomic
 * upsert per hit, so it is correct under concurrency and survives restarts.
 */
export type RateLimitResult = { ok: boolean; count: number; retryAfterSeconds: number };

export async function hitRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;

  // Opportunistic cleanup so the table cannot grow without bound.
  if (Math.random() < 0.01) {
    await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`;
  }

  const { count, resetAt } = rows[0];
  return {
    ok: count <= limit,
    count,
    retryAfterSeconds: Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
}

export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/**
 * Client IP as seen by Nginx. Nginx sets X-Real-IP to $remote_addr; the app
 * binds 127.0.0.1 (ecosystem.config.js) so these headers can't be forged by
 * bypassing the proxy. X-Forwarded-For's LAST entry is the one Nginx appended —
 * earlier entries are client-supplied.
 */
export function clientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").map((s) => s.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  return "unknown";
}

export const LIMITS = {
  loginPerEmail: { limit: 5, windowSeconds: 15 * 60 },
  loginPerIp: { limit: 20, windowSeconds: 15 * 60 },
  leadPerIp: { limit: 5, windowSeconds: 60 * 60 },
  bookingPerIp: { limit: 5, windowSeconds: 60 * 60 },
  // Caps how often the site will email any one outside address.
  mailPerRecipient: { limit: 3, windowSeconds: 24 * 60 * 60 },
} as const;

export function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests — please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

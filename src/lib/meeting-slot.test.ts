import { afterAll, describe, expect, it } from "vitest";
import { hasTestDb } from "@/test/db";

// F-01: uniqueness is a partial index — only one CONFIRMED meeting per slot.
describe.skipIf(!hasTestDb)("Meeting slot uniqueness (Postgres)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { Prisma } = await import("@prisma/client");
  const scheduledAt = new Date("2031-01-07T10:00:00Z");
  const base = { name: "Test", email: "slot-test@example.test", topic: "t", durationMinutes: 30, icsUid: "x" };

  afterAll(async () => {
    await prisma.meeting.deleteMany({ where: { email: base.email } });
    await prisma.$disconnect();
  });

  it("frees the slot when a meeting is cancelled", async () => {
    const first = await prisma.meeting.create({ data: { ...base, scheduledAt } });
    await prisma.meeting.update({ where: { id: first.id }, data: { status: "CANCELLED" } });
    const second = await prisma.meeting.create({ data: { ...base, scheduledAt } });
    expect(second.status).toBe("CONFIRMED");
  });

  it("still rejects a second CONFIRMED meeting in the same slot", async () => {
    await expect(prisma.meeting.create({ data: { ...base, scheduledAt } })).rejects.toSatisfy(
      (e) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
    );
  });
});

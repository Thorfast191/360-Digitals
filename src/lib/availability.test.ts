import { describe, expect, it } from "vitest";
import { isSlotAvailable, computeAvailableSlots } from "./availability";

const config = {
  businessTimezone: "Europe/Paris",
  slotDurationMinutes: 30,
  minNoticeHours: 0,
  bookingWindowDays: 30,
};
const everyDay = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: "09:00",
  endTime: "17:00",
  active: true,
}));
const now = new Date("2026-11-16T06:00:00Z"); // Monday 07:00 in Paris

describe("isSlotAvailable — booking window (F-07)", () => {
  it("accepts a slot on the last day of the window", () => {
    // 30 days after Mon 16 Nov = Wed 16 Dec, 10:00 Paris = 09:00Z
    const scheduledAt = new Date("2026-12-16T09:00:00Z");
    expect(isSlotAvailable({ scheduledAt, config, rules: everyDay, blackoutDates: [], now })).toBe(true);
  });

  it("rejects a slot one day past the window", () => {
    const scheduledAt = new Date("2026-12-17T09:00:00Z");
    expect(isSlotAvailable({ scheduledAt, config, rules: everyDay, blackoutDates: [], now })).toBe(false);
  });

  it("rejects the year-out booking the audit reproduced", () => {
    const scheduledAt = new Date("2027-11-16T09:00:00Z");
    expect(isSlotAvailable({ scheduledAt, config, rules: everyDay, blackoutDates: [], now })).toBe(false);
  });

  it("agrees with computeAvailableSlots on every offered slot and on the window edge", () => {
    const slots = computeAvailableSlots({ config, rules: everyDay, blackoutDates: [], bookedSlots: [], now });
    for (const scheduledAt of slots) {
      expect(isSlotAvailable({ scheduledAt, config, rules: everyDay, blackoutDates: [], now })).toBe(true);
    }
    const lastOffered = slots[slots.length - 1];
    const dayAfter = new Date(lastOffered.getTime() + 24 * 60 * 60 * 1000);
    expect(isSlotAvailable({ scheduledAt: dayAfter, config, rules: everyDay, blackoutDates: [], now })).toBe(false);
  });
});

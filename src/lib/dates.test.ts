import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDate,
  isDateOnly,
  taskDate,
  today,
} from "./dates";
describe("date-only planning", () => {
  it.each(["2028-02-29", "2026-12-31"])("accepts %s", (date) =>
    expect(isDateOnly(date)).toBe(true),
  );
  it.each([
    "2026-02-29",
    "2026-13-01",
    "2026-04-31",
    "2026-1-1",
    "invalid",
    "9999-99-99",
  ])("rejects %s", (date) => expect(isDateOnly(date)).toBe(false));
  it("uses India time at the midnight boundary", () => {
    expect(today(() => new Date("2026-10-26T18:29:59Z"))).toBe("2026-10-26");
    expect(today(() => new Date("2026-10-26T18:30:00Z"))).toBe("2026-10-27");
  });
  it("handles leap years and year boundaries without DST shifts", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-27", "2026-10-26")).toBe(-1);
  });
  it("clamps compressed deadlines to the planning start", () => {
    expect(taskDate("2026-11-01", 30, "2026-10-26")).toBe("2026-10-26");
    expect(taskDate("2026-11-01", 1, "2026-10-26")).toBe("2026-10-31");
    expect(taskDate("2026-11-01", 0, "2026-10-26")).toBe("2026-11-01");
  });
  it("rejects invalid calculation inputs", () => {
    expect(() => addDays("oops", 1)).toThrow();
    expect(() => addDays("2026-01-01", 1.5)).toThrow();
    expect(() => daysBetween("oops", "2026-01-01")).toThrow();
    expect(() => daysBetween("2026-01-01", "oops")).toThrow();
  });
  it("formats human-readable dates", () => {
    expect(formatDate("2026-10-26")).toBe("26 Oct 2026");
  });
});

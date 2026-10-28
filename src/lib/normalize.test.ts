import { describe, expect, it } from "vitest";
import { normalizePlan } from "./normalize";
import { planSchema, recommendationsSchema } from "@/schemas/plan";
import { demoEvent, createDemoPlan } from "@/data/demo";
import { eventTypes } from "@/schemas/event";
import { clock, event, plan, recommendations } from "@/test/fixtures";

describe("normalisation and domain-specific plans", () => {
  it.each(eventTypes)(
    "produces a complete validated %s sample",
    async (type) => {
      const sample = await createDemoPlan(demoEvent(type, clock), clock);
      expect(planSchema.safeParse(sample).success).toBe(true);
      expect(sample.source).toBe("demo");
      expect(sample.tasks).toHaveLength(15);
      expect(sample.ideas).toHaveLength(4);
      expect(sample.invitations).toHaveLength(2);
      expect(sample.vendors.length).toBeGreaterThanOrEqual(3);
      expect(
        sample.tasks.every(
          (task) => task.dueDate <= sample.event.date && !task.completed,
        ),
      ).toBe(true);
      const words = sample.tasks
        .map((task) => task.title)
        .join(" ")
        .toLowerCase();
      if (type === "wedding") expect(words).toMatch(/wedding ceremony/);
      if (type === "birthday") expect(words).toMatch(/birthday cake/);
      if (type === "community") {
        expect(words).toMatch(/permissions/);
        expect(words).toMatch(/volunteer/);
        expect(words).toMatch(/accessibility and safety/);
      }
    },
  );
  it("owns financial totals and stable item IDs", () => {
    expect(plan.tasks[0].id).toBe(`${plan.id}-task-1`);
    expect(plan.vendors[0].id).toBe(`${plan.id}-vendor-1`);
    expect(
      plan.budget.reduce((sum, category) => sum + category.amountMinor, 0),
    ).toBe(event.budgetMinor);
    expect(plan.createdAt).toBe(clock().toISOString());
  });
  it("adds preparation warnings and clamps past due dates", () => {
    const compressed = normalizePlan(
      { ...event, date: "2026-10-28" },
      recommendations,
      "fingerprint",
      "ai",
      clock,
    );
    expect(compressed.warnings.join(" ")).toContain(
      "Preparation time is limited",
    );
    expect(compressed.tasks.every((task) => task.dueDate >= "2026-10-26")).toBe(
      true,
    );
  });
  it.each([
    {},
    { ...recommendations, tasks: [] },
    { ...recommendations, ideas: [] },
    { ...recommendations, invitations: [] },
  ])("refuses incomplete output", (output) =>
    expect(() =>
      normalizePlan(event, output, "fingerprint", "ai", clock),
    ).toThrow(),
  );
  it("rejects unbalanced or duplicated durable records", () => {
    expect(
      planSchema.safeParse({
        ...plan,
        budget: [{ id: "venue", label: "Venue", amountMinor: 1 }],
      }).success,
    ).toBe(false);
    for (const field of ["tasks", "vendors", "budget"] as const) {
      const items = [...plan[field]];
      items[1] = items[0];
      expect(planSchema.safeParse({ ...plan, [field]: items }).success).toBe(
        false,
      );
    }
  });
  it("validates all output bounds", () => {
    expect(
      recommendationsSchema.safeParse({
        ...recommendations,
        tasks: recommendations.tasks.map((task) => ({
          ...task,
          daysBefore: -1,
        })),
      }).success,
    ).toBe(false);
  });
});

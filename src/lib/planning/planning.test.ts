import { describe, expect, it } from "vitest";
import { eventTypes, currencies } from "@/schemas/event";
import { demoEvent, createDemoPlan } from "@/data/demo";
import { clock, plan } from "@/test/fixtures";
import { emptyEnhancements } from "@/schemas/enhancements";
import {
  financialPosition,
  scenarioDefaults,
  simulateScenario,
  compareQuotes,
} from "./finance";
import {
  applyScenario,
  validateWorkspace,
  decodeEnhancements,
  applyRefinement,
} from "./workspace";
import { inspectDependencies } from "./dependencies";
import { inspectReadiness } from "./readiness";
import {
  exampleSchedule,
  validateSchedule,
  parseTime,
  formatTime,
  reorderSchedule,
} from "./schedule";
import type { VendorQuote, Expense } from "@/schemas/finance";
export const quote = (overrides: Partial<VendorQuote> = {}): VendorQuote => ({
  id: crypto.randomUUID(),
  planId: plan.id,
  category: "venue",
  displayName: "User-entered option",
  quotedMinor: 1000000,
  commitmentMinor: 1000000,
  availability: "available",
  booking: "booked",
  quoteStatus: "written",
  notes: "",
  inclusions: [],
  source: "user",
  ...overrides,
});
export const expense = (
  vendor?: VendorQuote,
  overrides: Partial<Expense> = {},
): Expense => ({
  id: crypto.randomUUID(),
  planId: plan.id,
  category: vendor?.category ?? "venue",
  label: "Deposit",
  amountMinor: 200000,
  ...(vendor ? { vendorQuoteId: vendor.id } : {}),
  ...overrides,
});
describe("commitment-aware scenarios", () => {
  it.each(currencies)("reconciles exact amounts for %s", (currency) => {
    const base = { ...plan, event: { ...plan.event, currency } };
    for (const total of [1, 99, 100, 997, 100000, 100000000000]) {
      const result = simulateScenario(base, {
        ...scenarioDefaults(base),
        totalMinor: total,
      });
      expect(result.feasible).toBe(true);
      expect(
        result.allocations.reduce((sum, item) => sum + item.amountMinor, 0),
      ).toBe(total);
      expect(
        result.allocations.every(
          (item) =>
            item.amountMinor >= 0 && Number.isSafeInteger(item.amountMinor),
        ),
      ).toBe(true);
    }
  });
  it.each(eventTypes)("works across %s event templates", async (type) => {
    const event = await createDemoPlan(demoEvent(type, clock), clock);
    const scenario = scenarioDefaults(event);
    const before = structuredClone(event);
    for (const change of [
      { totalMinor: scenario.totalMinor * 2 },
      { totalMinor: Math.floor(scenario.totalMinor / 2) },
      { guests: scenario.guests + 50 },
      { guests: 1 },
      { priorities: ["catering" as const] },
      { contingencyPercent: 25 },
    ])
      expect(simulateScenario(event, { ...scenario, ...change }).feasible).toBe(
        true,
      );
    expect(event).toEqual(before);
  });
  it("does not double-count paid deposits and commitments", () => {
    const vendor = quote();
    const position = financialPosition(plan, [vendor], [expense(vendor)]);
    expect(position.protectedMinor).toBe(1000000);
    expect(position.paidMinor).toBe(200000);
    expect(position.outstandingMinor).toBe(800000);
    expect(position.contractualMinor).toBe(1000000);
  });
  it("protects paid amounts beyond commitments and unlinked expenses", () => {
    const vendor = quote();
    const result = financialPosition(
      plan,
      [vendor],
      [expense(vendor, { amountMinor: 2000000 }), expense()],
    );
    expect(result.protectedMinor).toBe(2200000);
    expect(result.outstandingMinor).toBe(0);
  });
  it("does not treat an unbooked quote as a contractual cost", () => {
    const vendor = quote({ booking: "shortlisted", commitmentMinor: 0 });
    expect(financialPosition(plan, [vendor], []).protectedMinor).toBe(0);
    expect(
      financialPosition(plan, [vendor], [expense(vendor)]).protectedMinor,
    ).toBe(200000);
  });
  it("reports impossible budgets and preserves all commitments", () => {
    const vendor = quote({ commitmentMinor: 2000000 });
    const result = simulateScenario(
      plan,
      { ...scenarioDefaults(plan), totalMinor: 1000000 },
      [vendor],
    );
    expect(result.feasible).toBe(false);
    expect(result.shortfallMinor).toBe(1100000);
    expect(
      result.allocations.find((item) => item.id === "venue")?.amountMinor,
    ).toBe(2000000);
    expect(result.warnings.join()).toContain("cannot be applied");
  });
  it("known category minima include, rather than duplicate, already committed costs", () => {
    const vendor = quote();
    const result = simulateScenario(
      plan,
      {
        ...scenarioDefaults(plan),
        knownCosts: [{ category: "venue", minimumMinor: 1200000 }],
      },
      [vendor],
      [expense(vendor)],
    );
    expect(result.protectedMinor).toBe(1200000);
  });
  it("supports zero discretionary balance and exact contingency", () => {
    const vendor = quote({ commitmentMinor: 900 });
    const result = simulateScenario(
      plan,
      { ...scenarioDefaults(plan), totalMinor: 1000 },
      [vendor],
    );
    expect(result.feasible).toBe(true);
    expect(
      result.allocations.reduce((sum, row) => sum + row.amountMinor, 0),
    ).toBe(1000);
  });
  it.each([
    { totalMinor: 0 },
    { guests: 0 },
    { contingencyPercent: -1 },
    { contingencyPercent: 51 },
    { knownCosts: [{ category: "cake" as const, minimumMinor: 1 }] },
    { priorities: ["cake" as const] },
  ])("rejects invalid scenarios %j", (value) => {
    expect(() =>
      simulateScenario(plan, { ...scenarioDefaults(plan), ...value }),
    ).toThrow();
  });
  it("compares only entered quotes without invented suitability scores", () => {
    const a = quote({ quotedMinor: 100 }),
      b = quote({ quotedMinor: 200 });
    const rows = compareQuotes(plan, [a, b], "venue");
    expect(rows[1].differenceFromLowestMinor).toBe(100);
    expect(rows[0].quote.availability).toBe("available");
    expect(compareQuotes(plan, [], "cake")).toEqual([]);
    expect(
      compareQuotes({ ...plan, budget: [] }, [a], "venue")[0]
        .overAllocationMinor,
    ).toBe(100);
  });
  it.each([
    "wrong-owner",
    "missing-reference",
    "duplicate",
    "wrong-category",
    "bad-booking",
  ])("rejects invalid ledger %s", (issue) => {
    const vendor = quote(
      issue === "wrong-owner"
        ? { planId: crypto.randomUUID() }
        : issue === "wrong-category"
          ? { category: "cake" }
          : issue === "bad-booking"
            ? { availability: "unavailable" }
            : {},
    );
    const payments =
      issue === "missing-reference"
        ? [expense(undefined, { vendorQuoteId: crypto.randomUUID() })]
        : [];
    expect(() =>
      financialPosition(
        plan,
        issue === "duplicate" ? [vendor, vendor] : [vendor],
        payments,
      ),
    ).toThrow();
  });
});
describe("task dependency graph and readiness", () => {
  const [a, b, c] = plan.tasks;
  it("inspects a DAG and identifies blocked and overdue dependencies", () => {
    const dependencies = [
      { taskId: b.id, dependsOn: [a.id] },
      { taskId: c.id, dependsOn: [b.id] },
    ];
    const graph = inspectDependencies(plan, dependencies);
    expect(graph.blocked.map((item) => item.id)).toEqual([b.id, c.id]);
    expect(graph.order.indexOf(a.id)).toBeLessThan(graph.order.indexOf(b.id));
    const current = {
      ...plan,
      tasks: plan.tasks.map((task) => ({ ...task, dueDate: "2026-10-01" })),
    };
    const report = inspectReadiness(current, [], [], dependencies, clock);
    expect(
      report.findings.some(
        (item) =>
          item.ruleId === "RULE_DEPENDENCY_BLOCKED" &&
          item.message.includes("overdue"),
      ),
    ).toBe(true);
    expect(
      report.findings.some(
        (item) => item.ruleId === "RULE_CRITICAL_TASK_OVERDUE",
      ),
    ).toBe(true);
  });
  it.each([
    [{ taskId: a.id, dependsOn: [a.id] }],
    [{ taskId: a.id, dependsOn: ["missing"] }],
    [{ taskId: "missing", dependsOn: [] }],
    [
      { taskId: a.id, dependsOn: [b.id] },
      { taskId: b.id, dependsOn: [a.id] },
    ],
    [
      { taskId: a.id, dependsOn: [] },
      { taskId: a.id, dependsOn: [] },
    ],
  ])("rejects invalid dependency graphs", (...dependencies) =>
    expect(() => inspectDependencies(plan, dependencies)).toThrow(),
  );
  it("preserves completed tasks even with incomplete prerequisites", () => {
    const modified = {
      ...plan,
      tasks: plan.tasks.map((task) =>
        task.id === b.id ? { ...task, completed: true } : task,
      ),
    };
    expect(
      inspectDependencies(modified, [{ taskId: b.id, dependsOn: [a.id] }])
        .blocked,
    ).toEqual([]);
    expect(modified.tasks[1].completed).toBe(true);
  });
  it("explains missing vendors, budget shortfalls and preparation compression", () => {
    const current = {
      ...plan,
      event: { ...plan.event, budgetMinor: 100, date: "2026-10-28" },
    };
    const report = inspectReadiness(current, [quote()], [], [], clock);
    expect(report.findings.map((item) => item.ruleId)).toContain(
      "RULE_BUDGET_SHORTFALL",
    );
    expect(report.findings.map((item) => item.ruleId)).toContain(
      "RULE_SHORT_PREPARATION_WINDOW",
    );
    expect(
      report.findings.filter(
        (item) => item.ruleId === "RULE_VENDOR_NOT_BOOKED",
      ),
    ).toHaveLength(3);
  });
  it("treats historical events as historical and uses the injected clock", () => {
    expect(
      inspectReadiness(plan, [], [], [], () => new Date("2030-01-01T00:00:00Z"))
        .status,
    ).toBe("Historical event");
    expect(inspectReadiness(plan, [], [], [], clock).remainingDays).toBe(120);
  });
  it("reports an event with completed vendor decisions and tasks without invented scores", () => {
    const ready = {
      ...plan,
      tasks: plan.tasks.map((task) => ({ ...task, completed: true })),
      vendors: plan.vendors.map((vendor) => ({ ...vendor, completed: true })),
    };
    expect(inspectReadiness(ready, [], [], [], clock).status).toBe(
      "No critical blockers found",
    );
  });
});
describe("event-day arithmetic and preservation", () => {
  it.each(eventTypes)(
    "validates a complete %s offline schedule",
    async (type) => {
      const base = await createDemoPlan(demoEvent(type, clock), clock);
      const schedule = exampleSchedule(
        type,
        { startMinute: 540, endMinute: 1021, timeZone: "Asia/Kolkata" },
        clock,
      );
      expect(validateSchedule(base, schedule).activities).toHaveLength(8);
      expect(
        schedule.activities.reduce(
          (sum, activity) => sum + activity.durationMinutes,
          0,
        ),
      ).toBe(481);
      expect(
        schedule.activities.at(-1)!.startMinute +
          schedule.activities.at(-1)!.durationMinutes,
      ).toBe(1021);
    },
  );
  it.each(["", "24:00", "12:60", "1:00", "text"])(
    "rejects invalid time %s",
    (value) => expect(parseTime(value)).toBeNull(),
  );
  it("parses, formats and reorders local minutes", () => {
    expect(parseTime("09:30")).toBe(570);
    expect(formatTime(570)).toBe("09:30");
    const sample = exampleSchedule(
      "wedding",
      { startMinute: 540, endMinute: 1020, timeZone: "UTC" },
      clock,
    );
    expect(
      reorderSchedule(sample, sample.activities).activities.at(-1)!.startMinute,
    ).toBe(960);
  });
  it("rejects overnight and insufficient example windows", () => {
    expect(() =>
      exampleSchedule("birthday", {
        startMinute: 1000,
        endMinute: 100,
        timeZone: "UTC",
      }),
    ).toThrow();
    expect(() =>
      exampleSchedule("birthday", {
        startMinute: 100,
        endMinute: 103,
        timeZone: "UTC",
      }),
    ).toThrow();
  });
  it.each([
    "overlap",
    "outside",
    "duplicate",
    "zero-duration",
    "missing-role",
    "wrong-order",
    "missing-task",
    "invalid-vendor",
  ])("rejects %s schedules", (issue) => {
    const schedule = exampleSchedule(
      "wedding",
      { startMinute: 540, endMinute: 1020, timeZone: "UTC" },
      clock,
    );
    if (issue === "overlap") schedule.activities[1].startMinute = 541;
    if (issue === "outside") schedule.activities[0].startMinute = 500;
    if (issue === "duplicate")
      schedule.activities[1].id = schedule.activities[0].id;
    if (issue === "zero-duration") schedule.activities[1].durationMinutes = 0;
    if (issue === "missing-role") schedule.activities[3].role = "break";
    if (issue === "wrong-order")
      [schedule.activities[2].role, schedule.activities[3].role] = [
        schedule.activities[3].role,
        schedule.activities[2].role,
      ];
    if (issue === "missing-task") schedule.activities[1].taskId = "unknown";
    if (issue === "invalid-vendor")
      schedule.activities[1].vendorCategory = "cake";
    expect(() => validateSchedule(plan, schedule)).toThrow();
  });
});
describe("trusted plan updates", () => {
  it("initialises legacy enhancements without changing the original plan", () => {
    expect(decodeEnhancements(undefined, plan)).toEqual(
      emptyEnhancements(plan.id),
    );
    expect(() => decodeEnhancements({ version: 99, data: {} }, plan)).toThrow();
  });
  it("requires a feasible same-owner scenario and preserves unrelated data", () => {
    const enhancements = emptyEnhancements(plan.id);
    const scenario = {
      id: crypto.randomUUID(),
      planId: plan.id,
      name: "Reduce budget",
      createdAt: clock().toISOString(),
      input: {
        ...scenarioDefaults(plan),
        totalMinor: 40000000,
        guests: 200,
        contingencyPercent: 15,
      },
    };
    const result = applyScenario({ plan, enhancements }, scenario);
    expect(result.plan.tasks).toEqual(plan.tasks);
    expect(result.plan.vendors).toEqual(plan.vendors);
    expect(result.plan.event.date).toBe(plan.event.date);
    expect(result.plan.event.currency).toBe(plan.event.currency);
    expect(
      result.plan.budget.reduce((sum, row) => sum + row.amountMinor, 0),
    ).toBe(40000000);
    expect(plan.event.budgetMinor).toBe(50000000);
    expect(() =>
      applyScenario(
        { plan, enhancements },
        { ...scenario, planId: crypto.randomUUID() },
      ),
    ).toThrow();
    expect(() =>
      applyScenario(
        {
          plan,
          enhancements: {
            ...enhancements,
            quotes: [quote({ commitmentMinor: 90000000 })],
          },
        },
        scenario,
      ),
    ).toThrow();
  });
  it("restricts refinements to their allowed fields", () => {
    const workspace = { plan, enhancements: emptyEnhancements(plan.id) };
    const output = {
      kind: "invitations" as const,
      invitations: ["A revised invitation"],
    };
    expect(
      applyRefinement(workspace, "formal-invitation", output).plan.invitations,
    ).toEqual(output.invitations);
    expect(() => applyRefinement(workspace, "rainy-day", output)).toThrow();
    expect(
      applyRefinement(workspace, "rainy-day", {
        kind: "ideas",
        ideas: plan.ideas,
      }).plan.budget,
    ).toEqual(plan.budget);
  });
  it("rejects ownership and duplicate decision corruption", () => {
    expect(() =>
      validateWorkspace(plan, {
        ...emptyEnhancements(plan.id),
        planId: crypto.randomUUID(),
      }),
    ).toThrow();
  });
});

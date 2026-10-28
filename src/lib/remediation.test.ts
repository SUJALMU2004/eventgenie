import { afterEach, expect, it, vi } from "vitest";
import { plan } from "@/test/fixtures";
import { emptyEnhancements } from "@/schemas/enhancements";
import { buildIntelligenceRequest, planFacts } from "./ai/intelligence";
import { analyzeContingency, applyContingency } from "./planning/contingency";
import { validateSchedule, exampleSchedule } from "./planning/schedule";
import { createDatabase } from "./storage/database";
import { createRepository } from "./storage/repository";
import { notifyRevision, revisionSource } from "./storage/notifications";
import { fieldErrors } from "./validation";
import type { Workspace } from "./planning/workspace";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const workspace = (): Workspace => ({
  plan: structuredClone(plan),
  enhancements: emptyEnhancements(plan.id),
});
it("keeps request context minimal when an ask question is incomplete or only concerns vendors", () => {
  const current = workspace();
  expect(() =>
    buildIntelligenceRequest(current, { operation: "ask-plan" }),
  ).toThrow("Ask a bounded");
  const vendors = buildIntelligenceRequest(current, {
    operation: "ask-plan",
    question: "Which supplier needs review?",
  });
  expect(vendors.context.references).toEqual(["vendors"]);
  expect(vendors.context.finances).toBeUndefined();
  expect(vendors.context.tasks).toEqual([]);
  const facts = planFacts(current, "Plan for 9999 extra guests");
  expect(facts.extraGuestTotal).toBeUndefined();
  expect(facts.finance.paidMinor).toBe(0);
});
it("rejects a category cost increase when its allocation is missing without modifying records", () => {
  const current = workspace();
  current.plan.budget = current.plan.budget.filter((row) => row.id !== "venue");
  const before = structuredClone(current);
  expect(() =>
    analyzeContingency(current, {
      kind: "cost-increase",
      category: "venue",
      amountMinor: 100,
    }),
  ).toThrow("Choose an affected budget category");
  expect(current).toEqual(before);
});
it("visits shared downstream tasks once and preserves completed dependents during a delayed task review", () => {
  const current = workspace(),
    [first, left, right, last] = current.plan.tasks;
  current.enhancements.dependencies = [
    { taskId: left.id, dependsOn: [first.id] },
    { taskId: right.id, dependsOn: [first.id] },
    { taskId: last.id, dependsOn: [left.id, right.id] },
  ];
  for (const item of [left, right, last]) {
    item.completed = true;
    item.dueDate = first.dueDate;
  }
  const result = analyzeContingency(current, {
    kind: "task-delay",
    taskId: first.id,
    newDueDate: current.plan.event.date,
  });
  expect(result.affectedTasks).toHaveLength(4);
  expect(new Set(result.affectedTasks).size).toBe(4);
  expect(result.edit?.taskId).toBe(first.id);
  const next = applyContingency(
    workspace(),
    { kind: "rain" },
    { financial: false, task: true, deadline: false },
  );
  expect(next.plan.tasks).toHaveLength(plan.tasks.length + 1);
});
it("reports a sorted schedule conflict against the original editable row index", () => {
  const schedule = exampleSchedule("wedding", {
    startMinute: 540,
    endMinute: 1020,
    timeZone: "Asia/Kolkata",
  });
  schedule.activities.reverse();
  const last = schedule.activities.at(-1);
  if (!last) throw new Error("Expected setup activity");
  last.startMinute = 539;
  try {
    validateSchedule(plan, schedule);
    throw new Error("Expected validation failure");
  } catch (error) {
    expect(fieldErrors(error)).toHaveProperty(
      `activities.${schedule.activities.length - 1}.startMinute`,
    );
  }
});
it("recovers from a blocked additive database upgrade and closes stale version connections", async () => {
  const name = `blocked-${crypto.randomUUID()}`;
  const held = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await expect(createDatabase(name).open()).rejects.toMatchObject({
    code: "UNAVAILABLE",
    message: expect.stringContaining("Another tab"),
  });
  held.close();
  const repository = createRepository(name);
  await repository.savePlan(plan);
  expect(await repository.loadPlan(plan.id)).toEqual(plan);
  const stale = await createDatabase(name).open();
  const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 4);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  expect(upgraded.objectStoreNames.contains("history")).toBe(true);
  expect(() => stale.transaction("plans")).toThrow();
  upgraded.close();
});
it("sends only revision metadata and always closes optional notification channels", () => {
  const postMessage = vi.fn(),
    close = vi.fn();
  vi.stubGlobal("window", {});
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      postMessage = postMessage;
      close = close;
    },
  );
  notifyRevision(plan.id, 2);
  expect(postMessage).toHaveBeenCalledWith({
    planId: plan.id,
    revision: 2,
    source: revisionSource,
  });
  expect(close).toHaveBeenCalledOnce();
  postMessage.mockImplementation(() => {
    throw new Error("Blocked channel");
  });
  expect(() => notifyRevision(plan.id, 3)).not.toThrow();
  expect(close).toHaveBeenCalledTimes(2);
});

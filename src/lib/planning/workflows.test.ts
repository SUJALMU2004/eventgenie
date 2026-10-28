import { describe, it, expect } from "vitest";
import { plan, clock } from "@/test/fixtures";
import { demoEvent, demoRecommendations } from "@/data/demo";
import { normalizePlan } from "@/lib/normalize";
import { addDays, today } from "@/lib/dates";
import { emptyEnhancements } from "@/schemas/enhancements";
import { eventTypes, currencies } from "@/schemas/event";
import {
  contingencyKinds,
  type ContingencyInput,
} from "@/schemas/intelligence";
import { addDecisionExamples } from "@/data/decision-examples";
import { vendorCategories } from "@/data/vendor-categories";
import { compareScenarios } from "./comparison";
import {
  applyTaskProposal,
  nextActions,
  type TaskProposal,
} from "./task-workflows";
import { analyzeContingency, applyContingency } from "./contingency";
import { scenarioDefaults } from "./finance";
import { inspectReadiness } from "./readiness";
import type { Workspace } from "./workspace";
const initial = (): Workspace => ({
  plan: structuredClone(plan),
  enhancements: emptyEnhancements(plan.id),
});
const task = (): TaskProposal => ({
  title: "Confirm a backup organiser",
  reason: "Agree who handles unexpected changes.",
  category: "venue",
  dueDate: addDays(today(clock), 7),
  priority: "high",
  relatedTaskIds: [],
  assumptions: [],
});
describe("reviewed task workflows", () => {
  it("prevents prerequisite deadline conflicts before committing task edits", () => {
    const workspace = initial();
    workspace.enhancements.dependencies = [
      { taskId: plan.tasks[1].id, dependsOn: [plan.tasks[0].id] },
    ];
    workspace.plan.tasks[0].dueDate = addDays(today(clock), 5);
    workspace.plan.tasks[1].dueDate = addDays(today(clock), 6);
    expect(() =>
      applyTaskProposal(
        workspace,
        {
          ...task(),
          relatedTaskIds: [plan.tasks[0].id],
          dueDate: addDays(today(clock), 4),
        },
        clock,
      ),
    ).toThrow("before an unfinished prerequisite");
    expect(() =>
      applyTaskProposal(
        workspace,
        {
          ...task(),
          taskId: plan.tasks[0].id,
          title: plan.tasks[0].title,
          dueDate: plan.event.date,
        },
        clock,
      ),
    ).toThrow("dependent deadlines");
    expect(() =>
      applyTaskProposal(
        workspace,
        {
          ...task(),
          taskId: plan.tasks[0].id,
          relatedTaskIds: [plan.tasks[0].id],
        },
        clock,
      ),
    ).toThrow("other tasks");
  });
  it("flags downstream deadline conflicts and keeps historic plans readable with the normal clock", () => {
    const workspace = initial();
    workspace.enhancements.dependencies = [
      { taskId: plan.tasks[1].id, dependsOn: [plan.tasks[0].id] },
    ];
    workspace.plan.tasks[0].dueDate = plan.event.date;
    workspace.plan.tasks[1].dueDate = addDays(plan.event.date, -1);
    expect(
      inspectReadiness(
        workspace.plan,
        [],
        [],
        workspace.enhancements.dependencies,
        clock,
      ).findings.some(
        (item) => item.ruleId === "RULE_DEPENDENCY_DEADLINE_CONFLICT",
      ),
    ).toBe(true);
    const result = analyzeContingency(
      workspace,
      {
        kind: "task-delay",
        taskId: plan.tasks[1].id,
        newDueDate: plan.event.date,
      },
      clock,
    );
    expect(result.edit?.taskId).toBe(plan.tasks[1].id);
    const conflict = analyzeContingency(
      {
        ...workspace,
        plan: {
          ...workspace.plan,
          tasks: workspace.plan.tasks.map((task, index) =>
            index === 0
              ? { ...task, dueDate: addDays(plan.event.date, -5) }
              : task,
          ),
        },
      },
      {
        kind: "task-delay",
        taskId: plan.tasks[0].id,
        newDueDate: plan.event.date,
      },
      clock,
    );
    expect(conflict.risks.some((risk) => risk.includes("downstream"))).toBe(
      true,
    );
    expect(conflict.edit).toBeUndefined();
    expect(
      inspectReadiness(
        { ...plan, event: { ...plan.event, date: "2020-01-01" } },
        [],
        [],
        [],
      ).status,
    ).toBe("Historical event");
  });
  it("bounds appended tasks while preserving the existing task identifiers", () => {
    const workspace = initial();
    workspace.plan.tasks = Array.from({ length: 60 }, (_, index) => ({
      ...plan.tasks[index % plan.tasks.length],
      id: `${plan.id}-task-${index}`,
    }));
    expect(() => applyTaskProposal(workspace, task(), clock)).toThrow();
    expect(workspace.plan.tasks).toHaveLength(60);
  });
  it("creates stable IDs, validates dependencies, preserves completion and edits only selected task", () => {
    const before = initial();
    before.plan.tasks[1].completed = true;
    const next = applyTaskProposal(
      before,
      {
        ...task(),
        dueDate: plan.event.date,
        relatedTaskIds: [plan.tasks[0].id],
      },
      clock,
    );
    expect(before.plan.tasks).toHaveLength(plan.tasks.length);
    const added = next.plan.tasks.at(-1)!;
    expect(added.id).toContain(plan.id);
    expect(added.completed).toBe(false);
    expect(next.enhancements.dependencies.at(-1)!.taskId).toBe(added.id);
    const changed = applyTaskProposal(
      next,
      {
        ...task(),
        taskId: added.id,
        title: "Confirm another responsible organiser",
        dueDate: addDays(today(clock), 8),
      },
      clock,
    );
    expect(changed.plan.tasks.at(-1)!.id).toBe(added.id);
    expect(changed.plan.tasks[1].completed).toBe(true);
    expect(changed.plan.budget).toEqual(before.plan.budget);
  });
  it.each(["2020-01-01", "2099-01-01", "2026-02-30"])(
    "rejects invalid deadline %s",
    (dueDate) =>
      expect(() =>
        applyTaskProposal(initial(), { ...task(), dueDate }, clock),
      ).toThrow(),
  );
  it("rejects completed edits, duplicates, missing references, categories and cycles", () => {
    const ws = initial();
    expect(() =>
      applyTaskProposal(
        ws,
        { ...task(), title: ws.plan.tasks[0].title.toUpperCase() },
        clock,
      ),
    ).toThrow("already exists");
    expect(() =>
      applyTaskProposal(ws, { ...task(), taskId: "foreign" }, clock),
    ).toThrow("does not exist");
    expect(() =>
      applyTaskProposal(ws, { ...task(), relatedTaskIds: ["foreign"] }, clock),
    ).toThrow("this event");
    expect(() =>
      applyTaskProposal(ws, { ...task(), category: "av" }, clock),
    ).toThrow("event type");
    ws.plan.tasks[0].completed = true;
    expect(() =>
      applyTaskProposal(ws, { ...task(), taskId: ws.plan.tasks[0].id }, clock),
    ).toThrow("Completed tasks");
    ws.plan.tasks[0].completed = false;
    ws.enhancements.dependencies = [
      { taskId: ws.plan.tasks[1].id, dependsOn: [ws.plan.tasks[0].id] },
    ];
    expect(() =>
      applyTaskProposal(
        ws,
        {
          ...task(),
          taskId: ws.plan.tasks[0].id,
          dueDate: ws.plan.tasks[1].dueDate,
          title: ws.plan.tasks[0].title,
          relatedTaskIds: [ws.plan.tasks[1].id],
        },
        clock,
      ),
    ).toThrow("cycle");
  });
  it.each(eventTypes)(
    "offers event-specific %s next steps and avoids duplicate suggestions",
    (type) => {
      const event = demoEvent(type, clock),
        p = normalizePlan(
          event,
          demoRecommendations(event),
          "sample",
          "demo",
          clock,
        );
      const ws = { plan: p, enhancements: emptyEnhancements(p.id) },
        result = nextActions(ws, clock);
      expect(result.tasks.length).toBeLessThanOrEqual(5);
      expect(result.proposal).toBeDefined();
      const added = applyTaskProposal(ws, result.proposal!, clock);
      expect(nextActions(added, clock).proposal).toBeUndefined();
      const historical = {
        ...ws,
        plan: { ...p, event: { ...p.event, date: "2020-01-01" } },
      };
      expect(nextActions(historical, clock).proposal).toBeUndefined();
    },
  );
});
describe("multi-strategy financial comparison", () => {
  it.each(currencies)(
    "compares exact %s allocations without mutating the original",
    (currency) => {
      const ws = initial();
      ws.plan.event.currency = currency;
      ws.enhancements.scenarios = [1, 2, 3].map((n) => ({
        id: crypto.randomUUID(),
        planId: plan.id,
        name: `Alternative ${n}`,
        createdAt: clock().toISOString(),
        input: {
          ...scenarioDefaults(ws.plan),
          totalMinor: ws.plan.event.budgetMinor - n * 11,
          contingencyPercent: n * 5,
        },
      }));
      const original = structuredClone(ws),
        result = compareScenarios(
          ws,
          ws.enhancements.scenarios.map((item) => item.id),
          clock,
        );
      expect(result.columns).toHaveLength(4);
      for (const column of result.columns)
        expect(
          column.allocations.reduce((sum, item) => sum + item.amountMinor, 0),
        ).toBe(column.totalMinor);
      expect(result.lowestBudget).toBe(ws.plan.event.budgetMinor - 33);
      expect(ws).toEqual(original);
      expect(result.outstanding).toBe(plan.tasks.length);
    },
  );
  it("protects commitments and reports infeasible alternatives", () => {
    const ws = addDecisionExamples(initial());
    ws.enhancements.scenarios = [
      {
        id: crypto.randomUUID(),
        planId: plan.id,
        name: "Not enough funds",
        createdAt: clock().toISOString(),
        input: { ...scenarioDefaults(plan), totalMinor: 1 },
      },
    ];
    const result = compareScenarios(
      ws,
      [ws.enhancements.scenarios[0].id],
      clock,
    );
    expect(result.columns[1].feasible).toBe(false);
    expect(result.columns[1].shortfallMinor).toBeGreaterThan(0);
    expect(result.finance.paidMinor).toBeGreaterThan(0);
  });
  it("rejects invalid selection, duplicates and foreign scenarios", () => {
    const ws = initial();
    expect(() => compareScenarios(ws, ["unknown"], clock)).toThrow();
    const id = crypto.randomUUID();
    expect(() => compareScenarios(ws, [id], clock)).toThrow("not saved");
    expect(() => compareScenarios(ws, [id, id], clock)).toThrow("once");
    expect(() =>
      compareScenarios(
        ws,
        Array.from({ length: 4 }, () => crypto.randomUUID()),
        clock,
      ),
    ).toThrow();
  });
});
describe("event-specific contingency playbooks", () => {
  for (const type of eventTypes)
    it.each(contingencyKinds)(
      `${type}: analyzes %s without changing real-world commitments`,
      (kind) => {
        const event = demoEvent(type, clock),
          p = normalizePlan(
            event,
            demoRecommendations(event),
            "sample",
            "demo",
            clock,
          ),
          ws = { plan: p, enhancements: emptyEnhancements(p.id) };
        const input: ContingencyInput = {
          kind,
          amountMinor: 1000,
          guests:
            kind === "attendance-drop" ? event.guests - 5 : event.guests + 20,
          category: vendorCategories(type)[0].id,
          taskId: p.tasks[0].id,
          newDueDate: p.event.date,
        };
        const copy = structuredClone(ws),
          analysis = analyzeContingency(ws, input, clock);
        expect(analysis.actions.length).toBeGreaterThan(0);
        expect(analysis.limitations[0]).toContain("No live weather");
        expect(ws).toEqual(copy);
        expect(analysis.proposal.priority).toBe("high");
      },
    );
  it("selectively applies a financial and task proposal while preserving unrelated fields", () => {
    const ws = initial();
    ws.plan.tasks[1].completed = true;
    const next = applyContingency(
      ws,
      { kind: "guest-increase", guests: ws.plan.event.guests + 10 },
      { financial: true, task: true, deadline: false },
      clock,
    );
    expect(next.plan.event.guests).toBe(ws.plan.event.guests + 10);
    expect(
      next.plan.budget.reduce((sum, row) => sum + row.amountMinor, 0),
    ).toBe(ws.plan.event.budgetMinor);
    expect(next.plan.tasks[1]).toEqual(ws.plan.tasks[1]);
    expect(next.enhancements.quotes).toEqual(ws.enhancements.quotes);
    expect(next.plan.invitations).toEqual(ws.plan.invitations);
  });
  it("moves only an approved incomplete deadline and reports downstream tasks", () => {
    const ws = initial();
    ws.plan.tasks[1].dueDate = plan.event.date;
    ws.plan.tasks[2].dueDate = plan.event.date;
    ws.enhancements.dependencies = [
      { taskId: plan.tasks[1].id, dependsOn: [plan.tasks[0].id] },
      { taskId: plan.tasks[2].id, dependsOn: [plan.tasks[1].id] },
    ];
    const input: ContingencyInput = {
      kind: "task-delay",
      taskId: plan.tasks[0].id,
      newDueDate: plan.event.date,
    };
    expect(analyzeContingency(ws, input, clock).affectedTasks).toHaveLength(3);
    const next = applyContingency(
      ws,
      input,
      { financial: false, task: false, deadline: true },
      clock,
    );
    expect(next.plan.tasks[0].dueDate).toBe(plan.event.date);
    expect(next.plan.tasks[1]).toEqual(ws.plan.tasks[1]);
    expect(() =>
      applyContingency(
        ws,
        { kind: "rain" },
        { financial: false, task: false, deadline: true },
        clock,
      ),
    ).toThrow("No valid deadline");
  });
  it("flags deadlines beyond the event without silently applying them", () => {
    const ws = initial(),
      result = analyzeContingency(
        ws,
        {
          kind: "task-delay",
          taskId: plan.tasks[0].id,
          newDueDate: addDays(plan.event.date, 1),
        },
        clock,
      );
    expect(result.edit).toBeUndefined();
    expect(result.risks[0]).toContain("Critical");
  });
  it.each<ContingencyInput>([
    { kind: "budget-reduction" },
    { kind: "budget-reduction", amountMinor: plan.event.budgetMinor },
    { kind: "cost-increase", amountMinor: 100, category: "av" },
    { kind: "vendor-cancellation", category: "av" },
    { kind: "guest-increase", guests: 1 },
    { kind: "attendance-drop", guests: 10000 },
    { kind: "task-delay", taskId: "foreign", newDueDate: plan.event.date },
    {
      kind: "task-delay",
      taskId: plan.tasks[0].id,
      newDueDate: plan.tasks[0].dueDate,
    },
  ])("rejects invalid contingency $kind", (input) =>
    expect(() => analyzeContingency(initial(), input, clock)).toThrow(),
  );
  it("requires selected supported changes and rejects infeasibility", () => {
    const ws = addDecisionExamples(initial());
    expect(() =>
      applyContingency(
        ws,
        { kind: "rain" },
        { financial: false, task: false, deadline: false },
        clock,
      ),
    ).toThrow("Select");
    expect(() =>
      applyContingency(
        ws,
        { kind: "rain" },
        { financial: true, task: false, deadline: false },
        clock,
      ),
    ).toThrow("infeasible");
    expect(() =>
      applyContingency(
        ws,
        { kind: "budget-reduction", amountMinor: plan.event.budgetMinor - 1 },
        { financial: true, task: false, deadline: false },
        clock,
      ),
    ).toThrow("infeasible");
  });
});

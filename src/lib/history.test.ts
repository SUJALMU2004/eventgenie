import { describe, it, expect } from "vitest";
import {
  emptyHistory,
  recordRevision,
  restoreRevision,
  decodeHistory,
  historySnapshot,
  changeDescription,
} from "./history";
import { plan, clock } from "@/test/fixtures";
import { emptyEnhancements } from "@/schemas/enhancements";
import { emptyIntelligence } from "@/schemas/intelligence";
import { applyScenario, type Workspace } from "./planning/workspace";
import { scenarioDefaults } from "./planning/finance";
const initial = (): Workspace => ({
  plan: structuredClone(plan),
  enhancements: emptyEnhancements(plan.id),
});
const change = (workspace: Workspace): Workspace => ({
  ...workspace,
  plan: {
    ...workspace.plan,
    tasks: workspace.plan.tasks.map((task, index) =>
      index ? task : { ...task, completed: !task.completed },
    ),
  },
  enhancements: {
    ...workspace.enhancements,
    revision: workspace.enhancements.revision + 1,
  },
});
describe("bounded deterministic history", () => {
  it("retains recent local answers when undoing an unrelated task change", () => {
    const before = initial(),
      after = change(before),
      history = recordRevision(before, after, emptyHistory(plan.id), 20, clock);
    after.enhancements.intelligence = {
      ...emptyIntelligence(),
      exchanges: [
        {
          id: crypto.randomUUID(),
          question: "Which task is urgent?",
          answer: {
            kind: "answer",
            answer: "Review the next unfinished task.",
            references: ["timeline"],
            ideas: [],
            assumptions: [],
            limitations: ["Recorded facts may change."],
          },
          createdAt: clock().toISOString(),
          fingerprint: "local-answer",
          source: "demo",
        },
      ],
    };
    const restored = restoreRevision(after, history, "undo", 20, clock);
    expect(restored.workspace.enhancements.intelligence?.exchanges).toEqual(
      after.enhancements.intelligence.exchanges,
    );
    expect(restored.workspace.plan.tasks).toEqual(before.plan.tasks);
    expect(restored.history.updatedAt).toBe(clock().toISOString());
  });
  it("undoes, redoes and preserves stable task identities", () => {
    const before = initial(),
      after = change(before),
      history = recordRevision(before, after, emptyHistory(plan.id), 20, clock);
    expect(history.undo[0].at).toBe(clock().toISOString());
    const undone = restoreRevision(after, history, "undo");
    expect(undone.workspace.plan).toEqual(before.plan);
    expect(undone.workspace.enhancements.revision).toBe(2);
    const redone = restoreRevision(undone.workspace, undone.history, "redo");
    expect(redone.workspace.plan).toEqual(after.plan);
    expect(redone.workspace.plan.tasks[0].id).toBe(plan.tasks[0].id);
  });
  it("undoes a scenario while retaining identifiers and completion", () => {
    const before = change(initial());
    const scenario = {
      id: crypto.randomUUID(),
      planId: plan.id,
      name: "Alternative",
      createdAt: clock().toISOString(),
      input: {
        ...scenarioDefaults(plan),
        totalMinor: plan.event.budgetMinor - 1000,
      },
    };
    const after = applyScenario(before, scenario);
    after.enhancements.revision = 2;
    const history = recordRevision(before, after, emptyHistory(plan.id, 1));
    expect(restoreRevision(after, history, "undo").workspace.plan).toEqual(
      before.plan,
    );
    expect(changeDescription(before, after)).toContain("financial");
  });
  it.each([1, 3, 20, 30])(
    "bounds history at %i and invalidates redo after a new edit",
    (limit) => {
      let current = initial(),
        history = emptyHistory(plan.id);
      for (let n = 0; n < 35; n++) {
        const next = change(current);
        history = recordRevision(current, next, history, limit, clock);
        current = next;
      }
      expect(history.undo).toHaveLength(limit);
      const undone = restoreRevision(current, history, "undo", limit);
      const edited = change(undone.workspace);
      expect(
        recordRevision(undone.workspace, edited, undone.history, limit).redo,
      ).toEqual([]);
    },
  );
  it.each([0, 31, 1.5])("rejects invalid limit %s", (limit) => {
    expect(() =>
      recordRevision(
        initial(),
        change(initial()),
        emptyHistory(plan.id),
        limit,
      ),
    ).toThrow("History limit");
  });
  it("does not record cache or conversation metadata as plan revisions", () => {
    const before = initial(),
      after = initial();
    after.enhancements.intelligence = emptyIntelligence();
    after.enhancements.revision = 1;
    const history = recordRevision(before, after, emptyHistory(plan.id));
    expect(history.undo).toEqual([]);
    expect(history.revision).toBe(1);
    expect(historySnapshot(after).enhancements.intelligence?.cache).toEqual([]);
  });
  it.each(["undo", "redo"] as const)("rejects empty %s", (direction) =>
    expect(() =>
      restoreRevision(initial(), emptyHistory(plan.id), direction),
    ).toThrow("Nothing to"),
  );
  it("validates ownership, versions, corruption and revision alignment", () => {
    const current = initial();
    expect(decodeHistory(undefined, current).undo).toEqual([]);
    for (const raw of [
      { version: 9, data: {} },
      { version: 1, data: {} },
    ])
      expect(() => decodeHistory(raw, current)).toThrow(
        "corrupt or incompatible",
      );
    const after = change(current),
      history = recordRevision(current, after, emptyHistory(plan.id));
    expect(decodeHistory({ version: 1, data: history }, after)).toEqual(
      history,
    );
    expect(() =>
      decodeHistory({ version: 1, data: { ...history, revision: 0 } }, after),
    ).toThrow("revision or ownership");
    const other = structuredClone(history);
    other.undo[0].snapshot.plan.id = crypto.randomUUID();
    expect(() => decodeHistory({ version: 1, data: other }, after)).toThrow(
      "different event",
    );
    const bad = structuredClone(history);
    bad.undo[0].snapshot.enhancements.planId = crypto.randomUUID();
    expect(() => decodeHistory({ version: 1, data: bad }, after)).toThrow(
      "different event",
    );
  });
  it.each(["quotes", "expenses", "schedule", "dependencies"] as const)(
    "describes %s changes without private payloads",
    (field) => {
      const before = initial(),
        after = initial();
      Object.assign(after.enhancements, { [field]: [{ private: "contact" }] });
      expect(changeDescription(before, after)).not.toContain("contact");
    },
  );
  it("describes task, invitation and general changes", () => {
    expect(changeDescription(initial(), change(initial()))).toContain("tasks");
    const next = initial();
    next.plan.invitations = ["A revised draft"];
    expect(changeDescription(initial(), next)).toContain("invitation");
    expect(changeDescription(initial(), initial())).toBe(
      "Update event decisions",
    );
  });
});

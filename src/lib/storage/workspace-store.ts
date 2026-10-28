import {
  decodeHistory,
  recordRevision,
  restoreRevision,
  type PlanHistory,
} from "@/lib/history";
import { planSchema, type EventPlan } from "@/schemas/plan";
import {
  decodeEnhancements,
  validateWorkspace,
  type Workspace,
} from "@/lib/planning/workspace";
import { decodeRecord } from "./records";
import { StorageFailure } from "./errors";
import { requestValue, transactionDone, type Database } from "./database";
import { notifyRevision } from "./notifications";
import type { MutationOptions } from "./contracts";
export function createWorkspaceStore(
  connection: Database,
  limit: number,
  clock?: () => Date,
) {
  const { open } = connection;
  async function readWorkspace(id: string, withHistory = false) {
    const database = await open();
    try {
      const transaction = database.transaction(
        withHistory
          ? ["plans", "enhancements", "history"]
          : ["plans", "enhancements"],
        "readonly",
      );
      const [rawPlan, rawDecisions, rawHistory] = await Promise.all([
        requestValue(transaction.objectStore("plans").get(id)),
        requestValue(transaction.objectStore("enhancements").get(id)),
        withHistory
          ? requestValue(transaction.objectStore("history").get(id))
          : Promise.resolve(undefined),
      ]);
      if (rawPlan === undefined) return undefined;
      const plan = decodeRecord(rawPlan, planSchema),
        workspace = {
          plan,
          enhancements: decodeEnhancements(rawDecisions, plan),
        };
      return { workspace, rawHistory };
    } finally {
      database.close();
    }
  }
  async function commit(
    id: string,
    mutation: ((value: Workspace) => Workspace) | undefined,
    fallback?: EventPlan,
    options: MutationOptions = {},
    direction?: "undo" | "redo",
  ): Promise<Workspace> {
    const database = await open();
    try {
      const transaction = database.transaction(
        ["plans", "events", "enhancements", "history"],
        "readwrite",
      );
      const settled = transactionDone(transaction).then(
        () => ({ ok: true as const }),
        (error) => ({ ok: false as const, error: error as unknown }),
      );
      try {
        const plans = transaction.objectStore("plans"),
          decisions = transaction.objectStore("enhancements"),
          histories = transaction.objectStore("history");
        const [rawPlan, rawEnhancements, rawHistory] = await Promise.all([
          requestValue(plans.get(id)),
          requestValue(decisions.get(id)),
          requestValue(histories.get(id)),
        ]);
        const plan =
          rawPlan === undefined ? fallback : decodeRecord(rawPlan, planSchema);
        if (!plan || plan.id !== id)
          throw new StorageFailure(
            "NOT_FOUND",
            "This plan is no longer saved. Reopen the latest event.",
          );
        const current = {
          plan,
          enhancements: decodeEnhancements(rawEnhancements, plan),
        };
        if (
          options.expectedRevision !== undefined &&
          options.expectedRevision !== current.enhancements.revision
        )
          throw new StorageFailure(
            "CONFLICT",
            "Another tab changed this event. Reload the latest plan before applying changes.",
          );
        const history = decodeHistory(rawHistory, current);
        let next: Workspace, nextHistory: PlanHistory;
        if (direction) {
          const restored = restoreRevision(
            current,
            history,
            direction,
            limit,
            clock,
          );
          next = restored.workspace;
          nextHistory = restored.history;
        } else {
          const proposed = mutation!(structuredClone(current));
          next = validateWorkspace(proposed.plan, {
            ...proposed.enhancements,
            revision: current.enhancements.revision + 1,
          });
          if (next.plan.id !== id)
            throw new Error("A workspace update cannot change its event ID");
          nextHistory = recordRevision(
            current,
            next,
            history,
            limit,
            clock,
            options.description,
          );
        }
        plans.put({ version: 1, data: next.plan }, id);
        transaction
          .objectStore("events")
          .put({ version: 1, data: next.plan.event }, id);
        decisions.put({ version: 2, data: next.enhancements }, id);
        histories.put({ version: 1, data: nextHistory }, id);
        const result = await settled;
        if (!result.ok) throw result.error;
        notifyRevision(id, next.enhancements.revision);
        return next;
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          // A completed or already-aborted transaction cannot be aborted again.
          // Await its settled result below and preserve the original failure.
        }
        const result = await settled;
        if (
          error instanceof StorageFailure &&
          error.code === "UNAVAILABLE" &&
          !result.ok
        )
          throw result.error;
        throw error;
      }
    } finally {
      database.close();
    }
  }
  async function update(
    id: string,
    itemId: string,
    completed: boolean,
    field: "tasks" | "vendors",
  ): Promise<EventPlan> {
    const next = await commit(id, (current) => {
      if (!current.plan[field].some((item) => item.id === itemId))
        throw new StorageFailure("NOT_FOUND", "Checklist item not found.");
      return {
        ...current,
        plan: {
          ...current.plan,
          [field]: current.plan[field].map((item) =>
            item.id === itemId ? { ...item, completed } : item,
          ),
        },
      };
    });
    return next.plan;
  }

  return { readWorkspace, commit, update };
}

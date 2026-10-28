import { emptyEvent, eventSchema } from "@/schemas/event";
import { planSchema, type EventPlan } from "@/schemas/plan";
import { decodeHistory } from "@/lib/history";
import { createDatabase, requestValue } from "./database";
import { createRecordStore } from "./record-store";
import { createWorkspaceStore } from "./workspace-store";
import { decodeRecord, draftSchema } from "./records";
import { saveInitialPlan, importWorkspaceRecord } from "./plan-store";
import type { PlanRepository } from "./contracts";
export type { PlanRepository, MutationOptions } from "./contracts";
export { StorageFailure } from "./errors";
export { decodeRecord } from "./records";
export { revisionSource } from "./notifications";
/** Public compatibility facade; persistence and command internals stay separate. */
export function createRepository(
  name = "eventgenie-local-v1",
  config: { historyLimit?: number; clock?: () => Date } = {},
): PlanRepository {
  const limit = config.historyLimit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 30)
    throw new Error("History limit must be between 1 and 30.");
  const connection = createDatabase(name);
  const { open } = connection;
  const { read, write, remove } = createRecordStore(connection);
  const { readWorkspace, commit, update } = createWorkspaceStore(
    connection,
    limit,
    config.clock,
  );
  const repository: PlanRepository = {
    async loadWorkspace(id) {
      return (await readWorkspace(id))?.workspace;
    },
    importWorkspace: (workspace) =>
      importWorkspaceRecord(connection, workspace),
    async loadEnhancements(id) {
      return (await readWorkspace(id))?.workspace.enhancements;
    },
    mutateWorkspace: (id, mutation, fallback, options) =>
      commit(id, mutation, fallback, options),
    restoreHistory: (id, direction, expectedRevision) =>
      commit(id, undefined, undefined, { expectedRevision }, direction),
    async loadHistory(id) {
      const stored = await readWorkspace(id, true);
      return stored
        ? decodeHistory(stored.rawHistory, stored.workspace)
        : undefined;
    },
    saveEvent: (id, event) => write("events", id, eventSchema.parse(event)),
    savePlan: (plan) => saveInitialPlan(connection, plan),
    async loadPlan(id) {
      const raw = await read("plans", id);
      return raw === undefined ? undefined : decodeRecord(raw, planSchema);
    },
    async listPlans() {
      const database = await open();
      try {
        const records: unknown[] = await requestValue(
          database
            .transaction("plans", "readonly")
            .objectStore("plans")
            .getAll(),
        );
        const plans: EventPlan[] = [],
          issues: string[] = [];
        for (const record of records) {
          try {
            plans.push(decodeRecord(record, planSchema));
          } catch (error) {
            issues.push(
              error instanceof Error
                ? error.message
                : "Unreadable saved record",
            );
          }
        }
        return {
          plans: plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          issues,
        };
      } finally {
        database.close();
      }
    },
    updateTask: (id, taskId, completed) =>
      update(id, taskId, completed, "tasks"),
    updateVendor: (id, vendorId, completed) =>
      update(id, vendorId, completed, "vendors"),
    deletePlan: (id) =>
      remove(["plans", "events", "enhancements", "history"], id),
    saveDraft: (event) => write("drafts", "current", draftSchema.parse(event)),
    async loadDraft() {
      const raw = await read("drafts", "current");
      return raw === undefined
        ? undefined
        : { ...emptyEvent(), ...decodeRecord(raw, draftSchema) };
    },
    clearDraft: () => remove(["drafts"], "current"),
    async findReusable(fingerprint) {
      return (await repository.listPlans()).plans.find(
        (plan) => plan.source === "ai" && plan.fingerprint === fingerprint,
      );
    },
  };
  return repository;
}
export const planRepository = createRepository();

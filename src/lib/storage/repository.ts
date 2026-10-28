import { z } from "zod";
export const revisionSource = crypto.randomUUID();
import {
  decodeHistory,
  recordRevision,
  restoreRevision,
  type PlanHistory,
} from "@/lib/history";
import { emptyEvent, eventSchema, type EventInput } from "@/schemas/event";
import { planSchema, type EventPlan } from "@/schemas/plan";
import {
  decodeEnhancements,
  validateWorkspace,
  type Workspace,
} from "@/lib/planning/workspace";
import { type PlanEnhancements } from "@/schemas/enhancements";

export class StorageFailure extends Error {
  constructor(
    public code:
      | "UNAVAILABLE"
      | "CORRUPT"
      | "INCOMPATIBLE"
      | "WRITE_FAILED"
      | "NOT_FOUND"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "StorageFailure";
  }
}
const draftSchema = eventSchema.extend({
  title: z.string().max(100),
  city: z.string().max(100),
  date: z.string().max(10),
  guests: z.number().int().min(0).max(10000),
  budgetMinor: z.number().int().min(0).max(100000000000),
});
const envelopeSchema = z.object({ version: z.literal(1), data: z.unknown() });

export function decodeRecord<T>(value: unknown, schema: z.ZodType<T>): T {
  const envelope = envelopeSchema.safeParse(value);
  if (!envelope.success)
    throw new StorageFailure(
      "INCOMPATIBLE",
      "This saved record uses an unsupported version. It has not been changed.",
    );
  const record = schema.safeParse(envelope.data.data);
  if (!record.success)
    throw new StorageFailure(
      "CORRUPT",
      "A saved record could not be read. Other plans are unaffected.",
    );
  return record.data;
}
function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new StorageFailure(
          "UNAVAILABLE",
          "Browser storage is unavailable. Your plan remains open in this tab.",
        ),
      );
  });
}
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () =>
      reject(
        new StorageFailure(
          "WRITE_FAILED",
          "Could not save in this browser. Storage may be full or restricted. Keep this tab open and retry saving.",
        ),
      );
  });
}

export type MutationOptions = {
  expectedRevision?: number;
  description?: string;
};
export interface PlanRepository {
  loadWorkspace(id: string): Promise<Workspace | undefined>;
  loadHistory(id: string): Promise<PlanHistory | undefined>;
  restoreHistory(
    id: string,
    direction: "undo" | "redo",
    expectedRevision: number,
  ): Promise<Workspace>;
  importWorkspace(workspace: Workspace): Promise<void>;
  loadEnhancements(id: string): Promise<PlanEnhancements | undefined>;
  mutateWorkspace(
    id: string,
    mutation: (current: Workspace) => Workspace,
    fallback?: EventPlan,
    options?: MutationOptions,
  ): Promise<Workspace>;
  saveEvent(id: string, event: EventInput): Promise<void>;
  savePlan(plan: EventPlan): Promise<void>;
  loadPlan(id: string): Promise<EventPlan | undefined>;
  listPlans(): Promise<{ plans: EventPlan[]; issues: string[] }>;
  updateTask(
    id: string,
    taskId: string,
    completed: boolean,
  ): Promise<EventPlan>;
  updateVendor(
    id: string,
    vendorId: string,
    completed: boolean,
  ): Promise<EventPlan>;
  deletePlan(id: string): Promise<void>;
  saveDraft(event: EventInput): Promise<void>;
  loadDraft(): Promise<EventInput | undefined>;
  clearDraft(): Promise<void>;
  findReusable(fingerprint: string): Promise<EventPlan | undefined>;
}

export function createRepository(
  name = "eventgenie-local-v1",
  config: { historyLimit?: number; clock?: () => Date } = {},
): PlanRepository {
  const limit = config.historyLimit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 30)
    throw new Error("History limit must be between 1 and 30.");
  async function open(): Promise<IDBDatabase> {
    if (typeof indexedDB === "undefined")
      throw new StorageFailure(
        "UNAVAILABLE",
        "Browser storage is unavailable. Plans can only stay in this tab.",
      );
    try {
      const request = indexedDB.open(name, 3);
      request.onupgradeneeded = () => {
        for (const store of [
          "plans",
          "events",
          "drafts",
          "enhancements",
          "history",
        ])
          if (!request.result.objectStoreNames.contains(store))
            request.result.createObjectStore(store);
      };
      return await new Promise<IDBDatabase>((resolve, reject) => {
        let blocked = false;
        request.onsuccess = () => {
          if (blocked) request.result.close();
          else {
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
          }
        };
        request.onerror = () =>
          reject(
            new StorageFailure(
              "UNAVAILABLE",
              "Browser storage is unavailable. Your plan remains open in this tab.",
            ),
          );
        request.onblocked = () => {
          blocked = true;
          reject(
            new StorageFailure(
              "UNAVAILABLE",
              "Another tab is blocking browser storage. Close other EventGenie tabs and retry saving.",
            ),
          );
        };
      });
    } catch (error) {
      if (error instanceof StorageFailure) throw error;
      throw new StorageFailure(
        "UNAVAILABLE",
        "Browser storage is restricted. Your plan remains in this tab.",
      );
    }
  }
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
  async function read(store: string, key: string): Promise<unknown> {
    const database = await open();
    try {
      return await requestValue(
        database.transaction(store, "readonly").objectStore(store).get(key),
      );
    } finally {
      database.close();
    }
  }
  async function write(
    store: string,
    key: string,
    data: unknown,
  ): Promise<void> {
    const database = await open();
    try {
      const transaction = database.transaction(store, "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(store).put({ version: 1, data }, key);
      await done;
    } finally {
      database.close();
    }
  }
  async function remove(stores: string[], key: string): Promise<void> {
    const database = await open();
    try {
      const transaction = database.transaction(stores, "readwrite");
      const done = transactionDone(transaction);
      for (const store of stores) transaction.objectStore(store).delete(key);
      await done;
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
            config.clock,
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
            config.clock,
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
        if (
          typeof window !== "undefined" &&
          typeof BroadcastChannel !== "undefined"
        ) {
          // Notification is best effort: it must never turn a committed write
          // into an apparent failure. Revision checks remain authoritative.
          try {
            const channel = new BroadcastChannel("eventgenie-revisions");
            try {
              channel.postMessage({
                planId: id,
                revision: next.enhancements.revision,
                source: revisionSource,
              });
            } finally {
              channel.close();
            }
          } catch {}
        }
        return next;
      } catch (error) {
        try {
          transaction.abort();
        } catch {}
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
  const repository: PlanRepository = {
    async loadWorkspace(id) {
      return (await readWorkspace(id))?.workspace;
    },
    async importWorkspace(workspace) {
      const valid = validateWorkspace(workspace.plan, workspace.enhancements);
      const database = await open();
      try {
        const transaction = database.transaction(
          ["plans", "events", "enhancements"],
          "readwrite",
        );
        const done = transactionDone(transaction);
        transaction
          .objectStore("plans")
          .add({ version: 1, data: valid.plan }, valid.plan.id);
        transaction
          .objectStore("events")
          .add({ version: 1, data: valid.plan.event }, valid.plan.id);
        transaction
          .objectStore("enhancements")
          .add({ version: 2, data: valid.enhancements }, valid.plan.id);
        await done;
      } finally {
        database.close();
      }
    },
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
    async savePlan(plan) {
      const valid = planSchema.parse(plan);
      const database = await open();
      try {
        const transaction = database.transaction(
          ["plans", "events", "enhancements"],
          "readwrite",
        );
        const done = transactionDone(transaction);
        const settled = done.then(
          () => ({ ok: true as const }),
          (error) => ({ ok: false as const, error: error as unknown }),
        );
        try {
          const existing = await requestValue(
            transaction.objectStore("enhancements").get(valid.id),
          );
          if (
            existing !== undefined &&
            decodeEnhancements(existing, valid).revision > 0
          )
            throw new StorageFailure(
              "CONFLICT",
              "This event has saved decisions. Use a revision-checked update instead of replacing it.",
            );
          transaction
            .objectStore("plans")
            .put({ version: 1, data: valid }, valid.id);
          transaction
            .objectStore("events")
            .put({ version: 1, data: valid.event }, valid.id);
          const result = await settled;
          if (!result.ok) throw result.error;
        } catch (error) {
          try {
            transaction.abort();
          } catch {}
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
    },
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

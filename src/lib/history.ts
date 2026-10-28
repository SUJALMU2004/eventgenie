import { z } from "zod";
import { planSchema } from "@/schemas/plan";
import { enhancementSchema } from "@/schemas/enhancements";
import { validateWorkspace, type Workspace } from "./planning/workspace";
import { emptyIntelligence } from "@/schemas/intelligence";
const snapshotSchema = z
  .object({ plan: planSchema, enhancements: enhancementSchema })
  .strict();
const entrySchema = z
  .object({
    id: z.string().uuid(),
    description: z.string().min(1).max(120),
    at: z.string().datetime(),
    snapshot: snapshotSchema,
  })
  .strict();
export const historySchema = z
  .object({
    schemaVersion: z.literal(1),
    planId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    updatedAt: z.string().datetime().optional(),
    undo: z.array(entrySchema).max(30),
    redo: z.array(entrySchema).max(30),
  })
  .strict();
export type PlanHistory = z.infer<typeof historySchema>;
export const emptyHistory = (planId: string, revision = 0): PlanHistory => ({
  schemaVersion: 1,
  planId,
  revision,
  undo: [],
  redo: [],
});
/** Disposable caches and conversations are not duplicated into revision snapshots. */
export function historySnapshot(workspace: Workspace): Workspace {
  const enhancements = structuredClone(workspace.enhancements);
  enhancements.revision = 0;
  enhancements.cache = [];
  enhancements.intelligence = {
    ...(enhancements.intelligence ?? emptyIntelligence()),
    cache: [],
    exchanges: [],
  };
  return { plan: structuredClone(workspace.plan), enhancements };
}
export function decodeHistory(raw: unknown, current: Workspace): PlanHistory {
  if (raw === undefined)
    return emptyHistory(current.plan.id, current.enhancements.revision);
  const envelope = z
    .object({ version: z.literal(1), data: historySchema })
    .strict()
    .safeParse(raw);
  if (!envelope.success)
    throw new Error(
      "History is corrupt or incompatible. It has not been overwritten.",
    );
  const history = envelope.data.data;
  if (
    history.planId !== current.plan.id ||
    history.revision !== current.enhancements.revision
  )
    throw new Error("History revision or ownership does not match this event.");
  for (const entry of [...history.undo, ...history.redo]) {
    if (entry.snapshot.plan.id !== current.plan.id)
      throw new Error("History belongs to a different event.");
    validateWorkspace(entry.snapshot.plan, entry.snapshot.enhancements);
  }
  return history;
}
export function changeDescription(before: Workspace, after: Workspace): string {
  if (
    before.plan.event.budgetMinor !== after.plan.event.budgetMinor ||
    before.plan.event.guests !== after.plan.event.guests
  )
    return "Apply financial or guest-count decision";
  if (JSON.stringify(before.plan.tasks) !== JSON.stringify(after.plan.tasks))
    return "Update planning tasks or completion";
  if (
    JSON.stringify(before.plan.invitations) !==
    JSON.stringify(after.plan.invitations)
  )
    return "Update invitation draft";
  if (
    JSON.stringify(before.enhancements.quotes) !==
    JSON.stringify(after.enhancements.quotes)
  )
    return "Update vendor decision";
  if (
    JSON.stringify(before.enhancements.expenses) !==
    JSON.stringify(after.enhancements.expenses)
  )
    return "Update payment records";
  if (
    JSON.stringify(before.enhancements.schedule) !==
    JSON.stringify(after.enhancements.schedule)
  )
    return "Update event-day schedule";
  if (
    JSON.stringify(before.enhancements.dependencies) !==
    JSON.stringify(after.enhancements.dependencies)
  )
    return "Update task dependencies";
  return "Update event decisions";
}
export function recordRevision(
  before: Workspace,
  after: Workspace,
  history: PlanHistory,
  limit = 20,
  clock: () => Date = () => new Date(),
  description?: string,
): PlanHistory {
  if (!Number.isInteger(limit) || limit < 1 || limit > 30)
    throw new Error("History limit must be between 1 and 30.");
  const previous = historySnapshot(before),
    next = historySnapshot(after);
  const changed = JSON.stringify(previous) !== JSON.stringify(next);
  return historySchema.parse({
    ...history,
    revision: after.enhancements.revision,
    updatedAt: clock().toISOString(),
    undo: changed
      ? [
          ...history.undo,
          {
            id: crypto.randomUUID(),
            description: description ?? changeDescription(before, after),
            at: clock().toISOString(),
            snapshot: previous,
          },
        ].slice(-limit)
      : history.undo,
    redo: changed ? [] : history.redo,
  });
}
export function restoreRevision(
  current: Workspace,
  history: PlanHistory,
  direction: "undo" | "redo",
  limit = 20,
  clock: () => Date = () => new Date(),
): { workspace: Workspace; history: PlanHistory } {
  const source = history[direction],
    entry = source.at(-1);
  if (!entry) throw new Error(`Nothing to ${direction}.`);
  const reverse = direction === "undo" ? "redo" : "undo";
  const revision = current.enhancements.revision + 1;
  const workspace = validateWorkspace(entry.snapshot.plan, {
    ...entry.snapshot.enhancements,
    revision,
    intelligence: {
      ...(entry.snapshot.enhancements.intelligence ?? emptyIntelligence()),
      exchanges: current.enhancements.intelligence?.exchanges ?? [],
      cache: [],
    },
  });
  return {
    workspace,
    history: historySchema.parse({
      ...history,
      revision,
      updatedAt: clock().toISOString(),
      [direction]: source.slice(0, -1),
      [reverse]: [
        ...history[reverse],
        { ...entry, snapshot: historySnapshot(current) },
      ].slice(-limit),
    }),
  };
}

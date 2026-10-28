import { planSchema, type EventPlan } from "@/schemas/plan";
import {
  decodeEnhancements,
  validateWorkspace,
  type Workspace,
} from "@/lib/planning/workspace";
import { requestValue, transactionDone, type Database } from "./database";
import { StorageFailure } from "./errors";
export async function saveInitialPlan(connection: Database, plan: EventPlan) {
  const { open } = connection;
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
      } catch {
        // The transaction may already be settled; retain its original failure.
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

export async function importWorkspaceRecord(
  connection: Database,
  workspace: Workspace,
) {
  const { open } = connection;
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
}

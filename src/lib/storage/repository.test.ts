import { afterEach, describe, expect, it, vi } from "vitest";
import { createRepository, decodeRecord } from "./repository";
import { planSchema } from "@/schemas/plan";
import { eventSchema, emptyEvent } from "@/schemas/event";
import { event, plan } from "@/test/fixtures";

const unique = () => `test-${crypto.randomUUID()}`;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function database(name: string, version = 3): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
}
async function putRaw(name: string, key: string, value: unknown) {
  const db = await database(name);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("plans", "readwrite");
    transaction.objectStore("plans").put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = reject;
  });
  db.close();
}

describe("versioned IndexedDB repository", () => {
  it("saves and validates both an event and its complete plan", async () => {
    const repository = createRepository(unique());
    await repository.saveEvent(plan.id, event);
    await repository.savePlan(plan);
    expect(await repository.loadPlan(plan.id)).toEqual(plan);
    expect((await repository.listPlans()).plans).toEqual([plan]);
  });
  it("returns undefined for missing plans", async () => {
    const repository = createRepository(unique());
    expect(await repository.loadPlan("missing")).toBeUndefined();
  });
  it("persists task and vendor completion without replacing other progress", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    const updated = await repository.updateTask(
      plan.id,
      plan.tasks[0].id,
      true,
    );
    expect(updated.tasks[0].completed).toBe(true);
    const vendor = await repository.updateVendor(
      plan.id,
      plan.vendors[0].id,
      true,
    );
    expect(vendor.vendors[0].completed).toBe(true);
    expect(vendor.tasks[0].completed).toBe(true);
    expect((await repository.loadPlan(plan.id))?.vendors[0].completed).toBe(
      true,
    );
  });
  it("serialises concurrent checklist updates atomically", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    await Promise.all([
      repository.updateTask(plan.id, plan.tasks[0].id, true),
      repository.updateTask(plan.id, plan.tasks[1].id, true),
    ]);
    const updated = await repository.loadPlan(plan.id);
    expect(updated?.tasks.slice(0, 2).every((task) => task.completed)).toBe(
      true,
    );
  });
  it("handles missing plans and checklist IDs", async () => {
    const repository = createRepository(unique());
    await expect(
      repository.updateTask("missing", "task", true),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await repository.savePlan(plan);
    await expect(
      repository.updateTask(plan.id, "missing", true),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("deletes only the selected plan and its event", async () => {
    const repository = createRepository(unique());
    const other = { ...plan, id: crypto.randomUUID() };
    await repository.savePlan(plan);
    await repository.savePlan(other);
    await repository.deletePlan(plan.id);
    expect(await repository.loadPlan(plan.id)).toBeUndefined();
    expect(await repository.loadPlan(other.id)).toBeDefined();
  });
  it("keeps incomplete drafts and clears them independently", async () => {
    const repository = createRepository(unique());
    expect(await repository.loadDraft()).toBeUndefined();
    const draft = emptyEvent("community");
    await repository.saveDraft(draft);
    expect(await repository.loadDraft()).toEqual(draft);
    await repository.clearDraft();
    expect(await repository.loadDraft()).toBeUndefined();
  });
  it("reuses only genuine AI results", async () => {
    const repository = createRepository(unique());
    await repository.savePlan({ ...plan, source: "demo" });
    expect(await repository.findReusable(plan.fingerprint)).toBeUndefined();
    await repository.savePlan(plan);
    expect(await repository.findReusable(plan.fingerprint)).toEqual(plan);
    expect(await repository.findReusable("different")).toBeUndefined();
  });
  it("lists the newest plan first", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    const newer = {
      ...plan,
      id: crypto.randomUUID(),
      createdAt: "2026-10-27T12:00:00.000Z",
    };
    await repository.savePlan(newer);
    expect((await repository.listPlans()).plans[0].id).toBe(newer.id);
  });
  it("keeps historical plans readable", async () => {
    const repository = createRepository(unique());
    const historical = {
      ...plan,
      event: { ...plan.event, date: "2020-01-01" },
    };
    await repository.savePlan(historical);
    expect((await repository.loadPlan(plan.id))?.event.date).toBe("2020-01-01");
  });
  it("isolates corrupted and incompatible records without destroying good plans", async () => {
    const name = unique(),
      repository = createRepository(name);
    await repository.savePlan(plan);
    await putRaw(name, "corrupt", { version: 1, data: {} });
    await putRaw(name, "future", { version: 2, data: plan });
    const result = await repository.listPlans();
    expect(result.plans).toEqual([plan]);
    expect(result.issues).toHaveLength(2);
    await expect(repository.loadPlan("corrupt")).rejects.toMatchObject({
      code: "CORRUPT",
    });
    await expect(repository.loadPlan("future")).rejects.toMatchObject({
      code: "INCOMPATIBLE",
    });
  });
  it("rejects malformed plans before saving", async () => {
    await expect(
      createRepository(unique()).savePlan({ ...plan, tasks: [] }),
    ).rejects.toThrow();
  });
  it("surfaces unavailable storage instead of pretending to save", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(
      createRepository(unique()).savePlan(plan),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
  it("handles synchronous private-browsing restrictions", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("Denied", "SecurityError");
      },
    });
    await expect(createRepository(unique()).listPlans()).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
  });
  it("handles a database version conflict", async () => {
    const name = unique();
    const db = await database(name, 4);
    db.close();
    await expect(createRepository(name).listPlans()).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
  });
  it("surfaces transaction failures", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    const original = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (
      this: IDBDatabase,
      ...args: Parameters<typeof original>
    ) {
      const transaction = original.apply(this, args);
      if (args[1] === "readwrite") queueMicrotask(() => transaction.abort());
      return transaction;
    });
    await expect(repository.savePlan(plan)).rejects.toMatchObject({
      code: "WRITE_FAILED",
    });
    await expect(repository.saveDraft(emptyEvent())).rejects.toMatchObject({
      code: "WRITE_FAILED",
    });
    await expect(repository.deletePlan(plan.id)).rejects.toMatchObject({
      code: "WRITE_FAILED",
    });
  });
});
describe("explicit version handling", () => {
  it("decodes only version 1 records", () => {
    expect(decodeRecord({ version: 1, data: event }, eventSchema)).toEqual(
      event,
    );
    expect(() => decodeRecord({ version: 0, data: plan }, planSchema)).toThrow(
      "unsupported version",
    );
    expect(() => decodeRecord(null, planSchema)).toThrow();
    expect(() => decodeRecord({ version: 1, data: {} }, planSchema)).toThrow(
      "could not be read",
    );
  });
});

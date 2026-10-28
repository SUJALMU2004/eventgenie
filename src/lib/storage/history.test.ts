import { afterEach, describe, it, expect, vi } from "vitest";
import { createRepository } from "./repository";
import { plan, clock } from "@/test/fixtures";
import { emptyEnhancements } from "@/schemas/enhancements";
const unique = () => `history-${crypto.randomUUID()}`;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function database(name: string, version = 3) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
describe("transactional history and optimistic revisions", () => {
  it("returns the committed workspace even when cross-tab notifications are restricted", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    vi.stubGlobal("window", {});
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        constructor() {
          throw new DOMException("Restricted", "SecurityError");
        }
      },
    );
    const next = await repository.mutateWorkspace(plan.id, (current) => ({
      ...current,
      plan: {
        ...current.plan,
        tasks: current.plan.tasks.map((task, index) =>
          index === 0 ? { ...task, completed: true } : task,
        ),
      },
    }));
    expect(next.plan.tasks[0].completed).toBe(true);
    expect(next.enhancements.revision).toBe(1);
    expect((await repository.loadHistory(plan.id))?.undo).toHaveLength(1);
    expect(
      (await repository.loadWorkspace(plan.id))?.plan.tasks[0].completed,
    ).toBe(true);
  });
  it("returns one consistent plan and decision snapshot for dashboard hydration", async () => {
    const repository = createRepository(unique());
    expect(await repository.loadWorkspace(plan.id)).toBeUndefined();
    await repository.savePlan(plan);
    const snapshot = await repository.loadWorkspace(plan.id);
    expect(snapshot?.plan).toEqual(plan);
    expect(snapshot?.enhancements.planId).toBe(plan.id);
  });
  it("records legacy checklist writes, restores after refresh, and cascades deletion", async () => {
    const name = unique(),
      repository = createRepository(name);
    await repository.savePlan(plan);
    expect(await repository.loadHistory("missing")).toBeUndefined();
    await repository.updateTask(plan.id, plan.tasks[0].id, true);
    let history = (await createRepository(name).loadHistory(plan.id))!;
    expect(history.undo).toHaveLength(1);
    const undone = await repository.restoreHistory(plan.id, "undo", 1);
    expect(undone.plan.tasks[0].completed).toBe(false);
    history = (await repository.loadHistory(plan.id))!;
    expect(history.redo).toHaveLength(1);
    await repository.restoreHistory(plan.id, "redo", 2);
    expect((await repository.loadPlan(plan.id))!.tasks[0].completed).toBe(true);
    await repository.deletePlan(plan.id);
    expect(await repository.loadHistory(plan.id)).toBeUndefined();
    const db = await database(name);
    expect(
      await new Promise((resolve) => {
        const req = db
          .transaction("history")
          .objectStore("history")
          .get(plan.id);
        req.onsuccess = () => resolve(req.result);
      }),
    ).toBeUndefined();
    db.close();
  });
  it("adds history to an actual version-2 database without rewriting old records", async () => {
    const name = unique();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 2);
      request.onupgradeneeded = () => {
        for (const store of ["plans", "events", "drafts", "enhancements"])
          request.result.createObjectStore(store);
      };
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction(["plans", "enhancements", "drafts"], "readwrite");
        tx.objectStore("plans").put({ version: 1, data: plan }, plan.id);
        tx.objectStore("enhancements").put(
          { version: 2, data: emptyEnhancements(plan.id) },
          plan.id,
        );
        tx.objectStore("drafts").put(
          { version: 1, data: plan.event },
          "current",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
      request.onerror = () => reject(request.error);
    });
    const repository = createRepository(name);
    expect(await repository.loadPlan(plan.id)).toEqual(plan);
    expect(await repository.loadDraft()).toEqual(plan.event);
    expect((await repository.loadHistory(plan.id))!.undo).toEqual([]);
    await repository.updateVendor(plan.id, plan.vendors[0].id, true);
    expect((await repository.loadHistory(plan.id))!.undo).toHaveLength(1);
  });
  it("allows exactly one of two stale-tab writes", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    const results = await Promise.allSettled([
      repository.mutateWorkspace(
        plan.id,
        (current) => ({
          ...current,
          plan: { ...current.plan, invitations: ["Draft A"] },
        }),
        undefined,
        { expectedRevision: 0 },
      ),
      repository.mutateWorkspace(
        plan.id,
        (current) => ({
          ...current,
          plan: { ...current.plan, invitations: ["Draft B"] },
        }),
        undefined,
        { expectedRevision: 0 },
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
    expect((await repository.loadHistory(plan.id))!.undo).toHaveLength(1);
    await expect(
      repository.restoreHistory(plan.id, "undo", 0),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(repository.savePlan(plan)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  it("rolls back the plan when the history write aborts", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const request = original.apply(this, args);
      if (this.name === "history") this.transaction.abort();
      return request;
    });
    await expect(
      repository.updateTask(plan.id, plan.tasks[0].id, true),
    ).rejects.toMatchObject({ code: "WRITE_FAILED" });
    vi.restoreAllMocks();
    expect(await repository.loadPlan(plan.id)).toEqual(plan);
    expect((await repository.loadHistory(plan.id))!.undo).toEqual([]);
  });
  it("preserves corrupted history instead of resetting it", async () => {
    const name = unique(),
      repository = createRepository(name);
    await repository.savePlan(plan);
    const db = await database(name);
    await new Promise<void>((resolve) => {
      const tx = db.transaction("history", "readwrite");
      tx.objectStore("history").put({ version: 99, data: {} }, plan.id);
      tx.oncomplete = () => resolve();
    });
    db.close();
    await expect(repository.loadHistory(plan.id)).rejects.toThrow(
      "corrupt or incompatible",
    );
    await expect(
      repository.updateTask(plan.id, plan.tasks[0].id, true),
    ).rejects.toThrow("corrupt or incompatible");
    expect(await repository.loadPlan(plan.id)).toEqual(plan);
  });
  it("bounds stored history and rejects invalid configuration", async () => {
    expect(() => createRepository(unique(), { historyLimit: 0 })).toThrow(
      "History limit",
    );
    const repository = createRepository(unique(), { historyLimit: 2, clock });
    await repository.savePlan(plan);
    for (let n = 0; n < 5; n++)
      await repository.updateTask(plan.id, plan.tasks[0].id, n % 2 === 0);
    expect((await repository.loadHistory(plan.id))!.undo).toHaveLength(2);
  });
});

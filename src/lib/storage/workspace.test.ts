import { describe, expect, it } from "vitest";
import { createRepository } from "./repository";
import { emptyEnhancements } from "@/schemas/enhancements";
import { plan, clock } from "@/test/fixtures";
import { saveVendor, deleteVendor } from "@/lib/planning/vendors";
import { scenarioDefaults } from "@/lib/planning/finance";
import { validateWorkspace, applyScenario } from "@/lib/planning/workspace";
import type { VendorQuote } from "@/schemas/finance";
const unique = () => `decisions-${crypto.randomUUID()}`;
const vendor = (): VendorQuote => ({
  id: crypto.randomUUID(),
  planId: plan.id,
  category: "venue",
  displayName: "My supplier",
  quotedMinor: 100000,
  commitmentMinor: 0,
  availability: "unknown",
  booking: "considering",
  quoteStatus: "estimate",
  notes: "",
  inclusions: [],
  source: "user",
});
describe("additive IndexedDB migration and atomic workspaces", () => {
  it("upgrades an actual version-1 database while preserving old plans, drafts and completed tasks", async () => {
    const name = unique(),
      legacy = {
        ...plan,
        tasks: plan.tasks.map((task, index) =>
          index === 0 ? { ...task, completed: true } : task,
        ),
      };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        for (const store of ["plans", "events", "drafts"])
          request.result.createObjectStore(store);
      };
      request.onsuccess = () => {
        const database = request.result,
          transaction = database.transaction(
            ["plans", "events", "drafts"],
            "readwrite",
          );
        transaction
          .objectStore("plans")
          .put({ version: 1, data: legacy }, plan.id);
        transaction
          .objectStore("events")
          .put({ version: 1, data: plan.event }, plan.id);
        transaction
          .objectStore("drafts")
          .put({ version: 1, data: plan.event }, "current");
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = reject;
      };
      request.onerror = reject;
    });
    const repository = createRepository(name);
    expect(await repository.loadPlan(plan.id)).toEqual(legacy);
    expect(await repository.loadDraft()).toEqual(plan.event);
    expect(await repository.loadEnhancements(plan.id)).toEqual(
      emptyEnhancements(plan.id),
    );
    expect(await repository.loadEnhancements("missing")).toBeUndefined();
    await repository.mutateWorkspace(plan.id, (current) =>
      saveVendor(current, vendor()),
    );
    expect((await repository.loadPlan(plan.id))?.tasks[0].completed).toBe(true);
    expect((await repository.loadEnhancements(plan.id))?.quotes).toHaveLength(
      1,
    );
  });
  it("updates scenarios and vendor decisions without replacing concurrent task progress", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    const initial = await repository.mutateWorkspace(plan.id, (current) =>
      saveVendor(current, vendor()),
    );
    expect(initial.enhancements.revision).toBe(1);
    await Promise.all([
      repository.updateTask(plan.id, plan.tasks[0].id, true),
      repository.mutateWorkspace(plan.id, (current) => ({
        ...current,
        enhancements: {
          ...current.enhancements,
          scenarios: [
            {
              id: crypto.randomUUID(),
              planId: plan.id,
              name: "Budget review",
              createdAt: clock().toISOString(),
              input: scenarioDefaults(plan),
            },
          ],
        },
      })),
    ]);
    expect((await repository.loadPlan(plan.id))?.tasks[0].completed).toBe(true);
    expect(
      (await repository.loadEnhancements(plan.id))?.scenarios,
    ).toHaveLength(1);
  });
  it("keeps old records intact when validation fails", async () => {
    const repository = createRepository(unique());
    await repository.savePlan(plan);
    await expect(
      repository.mutateWorkspace(plan.id, (current) => ({
        ...current,
        enhancements: { ...current.enhancements, planId: crypto.randomUUID() },
      })),
    ).rejects.toThrow();
    expect(await repository.loadPlan(plan.id)).toEqual(plan);
    expect((await repository.loadEnhancements(plan.id))?.quotes).toEqual([]);
  });
  it("cannot change ownership and supports explicit creation with a fallback plan", async () => {
    const repository = createRepository(unique());
    await expect(
      repository.mutateWorkspace(plan.id, (current) => current),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const created = await repository.mutateWorkspace(
      plan.id,
      (current) => current,
      plan,
    );
    expect(created.plan.id).toBe(plan.id);
    await expect(
      repository.mutateWorkspace(plan.id, (current) => {
        const id = crypto.randomUUID();
        return {
          plan: { ...current.plan, id },
          enhancements: { ...current.enhancements, planId: id },
        };
      }),
    ).rejects.toThrow("cannot change");
    expect((await repository.loadPlan(plan.id))?.id).toBe(plan.id);
  });
  it("imports atomically and rejects collisions rather than merging", async () => {
    const repository = createRepository(unique());
    const workspace = { plan, enhancements: emptyEnhancements(plan.id) };
    await repository.importWorkspace(workspace);
    await expect(repository.importWorkspace(workspace)).rejects.toMatchObject({
      code: "WRITE_FAILED",
    });
    expect((await repository.listPlans()).plans).toHaveLength(1);
    expect(await repository.loadPlan(plan.id)).toEqual(plan);
  });
  it("cascades only the deleted event's decisions", async () => {
    const repository = createRepository(unique()),
      other = { ...plan, id: crypto.randomUUID() };
    await repository.importWorkspace({
      plan,
      enhancements: emptyEnhancements(plan.id),
    });
    await repository.importWorkspace({
      plan: other,
      enhancements: emptyEnhancements(other.id),
    });
    await repository.deletePlan(plan.id);
    expect(await repository.loadEnhancements(plan.id)).toBeUndefined();
    expect(await repository.loadEnhancements(other.id)).toBeDefined();
  });
});
describe("vendor and record invariants", () => {
  it("adds, edits and deletes manual quotes with explicit availability", () => {
    const quote = vendor(),
      workspace = { plan, enhancements: emptyEnhancements(plan.id) };
    const added = validateWorkspace(
      plan,
      saveVendor(workspace, quote).enhancements,
    );
    expect(added.enhancements.quotes).toHaveLength(1);
    const edited = saveVendor(added, {
      ...quote,
      availability: "unavailable",
      quotedMinor: 200000,
    });
    expect(edited.enhancements.quotes[0].quotedMinor).toBe(200000);
    expect(deleteVendor(edited, quote.id).enhancements.quotes).toEqual([]);
    expect(() => deleteVendor(workspace, "missing")).toThrow();
    expect(() =>
      saveVendor(added, { ...quote, id: crypto.randomUUID() }),
    ).toThrow("already exists");
  });
  it("does not delete commitments or linked paid records", () => {
    const quote = vendor(),
      workspace = {
        plan,
        enhancements: {
          ...emptyEnhancements(plan.id),
          quotes: [
            { ...quote, booking: "booked" as const, commitmentMinor: 100000 },
          ],
        },
      };
    expect(() => deleteVendor(workspace, quote.id)).toThrow("Unbook");
    const paid = {
      ...workspace,
      enhancements: {
        ...workspace.enhancements,
        quotes: [quote],
        expenses: [
          {
            id: crypto.randomUUID(),
            planId: plan.id,
            category: "venue" as const,
            label: "Deposit",
            amountMinor: 1,
            vendorQuoteId: quote.id,
          },
        ],
      },
    };
    expect(() => deleteVendor(paid, quote.id)).toThrow("detach");
  });
  it("validates scenario ownership, duplicate IDs and edited schedule references", () => {
    const state = emptyEnhancements(plan.id),
      scenario = {
        id: crypto.randomUUID(),
        planId: plan.id,
        name: "A",
        input: scenarioDefaults(plan),
        createdAt: clock().toISOString(),
      };
    expect(() =>
      validateWorkspace(plan, { ...state, scenarios: [scenario, scenario] }),
    ).toThrow("Duplicate");
    expect(() =>
      validateWorkspace(plan, {
        ...state,
        scenarios: [{ ...scenario, planId: crypto.randomUUID() }],
      }),
    ).toThrow("different plan");
  });
  it("scenario application preserves commitments, expenses and completion", () => {
    const quote = {
      ...vendor(),
      booking: "booked" as const,
      commitmentMinor: 100000,
    };
    const enhancements = {
      ...emptyEnhancements(plan.id),
      quotes: [quote],
      expenses: [
        {
          id: crypto.randomUUID(),
          planId: plan.id,
          category: "venue" as const,
          label: "Deposit",
          amountMinor: 20000,
          vendorQuoteId: quote.id,
        },
      ],
    };
    const applied = applyScenario(
      { plan, enhancements },
      {
        id: crypto.randomUUID(),
        planId: plan.id,
        name: "Changed guests",
        input: { ...scenarioDefaults(plan), guests: 300 },
        createdAt: clock().toISOString(),
      },
    );
    expect(applied.enhancements.quotes).toEqual(enhancements.quotes);
    expect(applied.enhancements.expenses).toEqual(enhancements.expenses);
    expect(applied.plan.tasks).toEqual(plan.tasks);
  });
});

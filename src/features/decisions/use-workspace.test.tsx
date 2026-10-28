// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWorkspace } from "./use-workspace";
import { planRepository, StorageFailure } from "@/lib/storage/repository";
import { emptyEnhancements } from "@/schemas/enhancements";
import { plan, clock } from "@/test/fixtures";
import { scenarioDefaults } from "@/lib/planning/finance";
import { emptyHistory } from "@/lib/history";
import type { Workspace } from "@/lib/planning/workspace";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("loads the dashboard when browser policy blocks cross-tab notifications", async () => {
  vi.spyOn(planRepository, "loadWorkspace").mockResolvedValue({
    plan,
    enhancements: emptyEnhancements(plan.id),
  });
  vi.spyOn(planRepository, "loadHistory").mockResolvedValue(
    emptyHistory(plan.id),
  );
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      constructor() {
        throw new DOMException("Restricted", "SecurityError");
      }
    },
  );
  const onChange = vi.fn();
  const { result } = renderHook(() => useWorkspace(plan, onChange));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(onChange).toHaveBeenCalledWith(plan);
  expect(result.current.workspace.enhancements.planId).toBe(plan.id);
});
it("preserves unsaved decisions and rejects a conflicting revision before retrying", async () => {
  const initial = emptyEnhancements(plan.id),
    change = vi.fn();
  vi.spyOn(planRepository, "loadWorkspace").mockResolvedValue({
    plan,
    enhancements: initial,
  });
  const save = vi
    .spyOn(planRepository, "mutateWorkspace")
    .mockRejectedValueOnce(new StorageFailure("UNAVAILABLE", "Restricted"));
  const { result } = renderHook(() => useWorkspace(plan, change));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(
      await result.current.update((current) => ({
        ...current,
        enhancements: {
          ...current.enhancements,
          scenarios: [
            {
              id: crypto.randomUUID(),
              planId: plan.id,
              name: "Unsaved",
              createdAt: clock().toISOString(),
              input: scenarioDefaults(plan),
            },
          ],
        },
      })),
    ).toBe(true);
  });
  expect(result.current.dirty).toBe(true);
  save.mockImplementation(async (_id, mutation) =>
    mutation({ plan, enhancements: { ...initial, revision: 1 } }),
  );
  await act(async () => {
    expect(await result.current.update((current) => current)).toBe(false);
  });
  expect(result.current.workspace.enhancements.scenarios).toHaveLength(1);
  expect(result.current.notice).toContain("Another tab changed");
});
it("does not recreate a previously saved event deleted in another tab", async () => {
  vi.spyOn(planRepository, "loadWorkspace").mockResolvedValue({
    plan,
    enhancements: emptyEnhancements(plan.id),
  });
  const save = vi
    .spyOn(planRepository, "mutateWorkspace")
    .mockRejectedValue(
      new StorageFailure("NOT_FOUND", "This event was deleted"),
    );
  const { result } = renderHook(() => useWorkspace(plan, vi.fn()));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(await result.current.update((current) => current)).toBe(false);
  });
  expect(save).toHaveBeenCalledWith(
    plan.id,
    expect.any(Function),
    undefined,
    expect.objectContaining({ expectedRevision: 0 }),
  );
  expect(result.current.notice).toContain("deleted");
});
it("does not replay an already committed mutation when the follow-up history read fails", async () => {
  const initial = emptyEnhancements(plan.id),
    change = vi.fn(),
    mutation = vi.fn((current: Workspace) => ({
      ...current,
      plan: { ...current.plan, invitations: ["Reviewed invitation"] },
    }));
  vi.spyOn(planRepository, "loadWorkspace").mockResolvedValue({
    plan,
    enhancements: initial,
  });
  vi.spyOn(planRepository, "loadHistory")
    .mockResolvedValueOnce(emptyHistory(plan.id))
    .mockRejectedValue(new StorageFailure("UNAVAILABLE", "Read unavailable"));
  vi.spyOn(planRepository, "mutateWorkspace").mockImplementation(
    async (_id, apply) => {
      const next = apply({ plan, enhancements: initial });
      return { ...next, enhancements: { ...next.enhancements, revision: 1 } };
    },
  );
  const { result } = renderHook(() => useWorkspace(plan, change));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(await result.current.update(mutation)).toBe(true);
  });
  expect(mutation).toHaveBeenCalledTimes(1);
  expect(result.current.dirty).toBe(false);
  expect(result.current.notice).toContain("Changes saved, but history");
});
it("loads plan and financial decisions from the same atomic workspace snapshot", async () => {
  const saved = {
      ...plan,
      tasks: [
        ...plan.tasks,
        {
          ...plan.tasks[0],
          id: `${plan.id}-task-new`,
          title: "A new saved task",
        },
      ],
    },
    enhancements = {
      ...emptyEnhancements(plan.id),
      revision: 2,
      dependencies: [
        { taskId: `${plan.id}-task-new`, dependsOn: [plan.tasks[0].id] },
      ],
    },
    change = vi.fn();
  vi.spyOn(planRepository, "loadWorkspace").mockResolvedValue({
    plan: saved,
    enhancements,
  });
  vi.spyOn(planRepository, "loadHistory").mockResolvedValue(
    emptyHistory(plan.id, 2),
  );
  const { result } = renderHook(() => useWorkspace(plan, change));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(change).toHaveBeenCalledWith(saved);
  expect(result.current.workspace.enhancements.dependencies[0].taskId).toBe(
    saved.tasks.at(-1)!.id,
  );
});

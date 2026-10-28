// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanDashboard } from "./dashboard";
import { plan } from "@/test/fixtures";
import { planRepository, StorageFailure } from "@/lib/storage/repository";
import { emptyEnhancements } from "@/schemas/enhancements";
import { emptyHistory } from "@/lib/history";
beforeEach(() => {
  vi.spyOn(planRepository, "loadWorkspace").mockResolvedValue({
    plan,
    enhancements: emptyEnhancements(plan.id),
  });
  vi.spyOn(planRepository, "loadHistory").mockResolvedValue(
    emptyHistory(plan.id),
  );
});
afterEach(() => vi.restoreAllMocks());
describe("usable event blueprint", () => {
  it("renders budget, timeline, vendors and invitations with sample provenance", () => {
    render(<PlanDashboard initialPlan={{ ...plan, source: "demo" }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      plan.event.title,
    );
    expect(
      screen.getByText("Sample plan · deterministic demo data"),
    ).toBeVisible();
    expect(
      screen.getByRole("table", {
        name: "Planned budget allocations, including contingency",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "Planning task completion" }),
    ).toHaveAttribute("value", "0");
  });
  it("persists checklist updates and allows filtering", async () => {
    const user = userEvent.setup();
    vi.spyOn(planRepository, "mutateWorkspace").mockResolvedValue({
      plan: {
        ...plan,
        tasks: plan.tasks.map((task, index) =>
          index === 0 ? { ...task, completed: true } : task,
        ),
      },
      enhancements: { ...emptyEnhancements(plan.id), revision: 1 },
    });
    render(<PlanDashboard initialPlan={plan} />);
    const checkbox = screen.getByRole("checkbox", {
      name: plan.tasks[0].title,
    });
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(planRepository.mutateWorkspace).toHaveBeenCalledWith(
      plan.id,
      expect.any(Function),
      undefined,
      expect.objectContaining({
        expectedRevision: 0,
        description: "Update task completion",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Completed" }));
    expect(
      screen.getByRole("checkbox", { name: plan.tasks[0].title }),
    ).toBeVisible();
    expect(
      screen.queryByRole("checkbox", { name: plan.tasks[1].title }),
    ).toBeNull();
  });
  it("keeps edits in the tab and offers retry when saving fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(planRepository, "mutateWorkspace")
      .mockRejectedValueOnce(
        new StorageFailure(
          "WRITE_FAILED",
          "Storage is full. Keep this tab open.",
        ),
      )
      .mockImplementation(async (_id, mutation) =>
        mutation({ plan, enhancements: emptyEnhancements(plan.id) }),
      );
    render(<PlanDashboard initialPlan={plan} />);
    await user.click(
      screen.getByRole("checkbox", { name: plan.tasks[0].title }),
    );
    await screen.findByRole("button", { name: "Retry saving this plan" });
    expect(
      screen.getByRole("checkbox", { name: plan.tasks[0].title }),
    ).toBeChecked();
    await user.click(
      screen.getByRole("button", { name: "Retry saving this plan" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Retry saving this plan" }),
      ).toBeNull(),
    );
  });
  it("copies invitations with an explicit unsent status", async () => {
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    render(<PlanDashboard initialPlan={plan} />);
    await user.click(screen.getByRole("button", { name: "Copy invitation 1" }));
    expect(write).toHaveBeenCalledWith(plan.invitations[0]);
    expect(
      screen.getByText("Invitation 1 copied. Nothing has been sent."),
    ).toBeVisible();
  });
  it("provides a safe clipboard fallback", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("Unavailable"),
    );
    render(<PlanDashboard initialPlan={plan} />);
    await user.click(screen.getByRole("button", { name: "Copy invitation 1" }));
    await screen.findByText(
      /Select the invitation text and copy it with your keyboard/,
    );
  });
});

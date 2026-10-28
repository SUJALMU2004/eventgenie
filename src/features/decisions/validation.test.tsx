// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScenarioPanel } from "./scenario-panel";
import { SchedulePanel } from "./schedule-panel";
import { TaskEditor } from "@/features/tasks/task-editor";
import { plan } from "@/test/fixtures";
import { emptyEnhancements } from "@/schemas/enhancements";
import { budgetCategories } from "@/data/templates";
import type { DecisionProps } from "./types";
import type { TaskProposal } from "@/lib/planning/task-workflows";
vi.mock("./ai-workbench", () => ({ AIWorkbench: () => null }));
function props(saved = true) {
  return {
    workspace: { plan, enhancements: emptyEnhancements(plan.id) },
    busy: false,
    update: vi.fn<DecisionProps["update"]>().mockResolvedValue(saved),
    confirm: vi.fn<DecisionProps["confirm"]>(),
  };
}
function open(container: HTMLElement) {
  container.querySelector("details")?.setAttribute("open", "");
}
const draft: TaskProposal = {
  title: "Review accessibility arrangements",
  reason: "Confirm step-free access with the venue",
  category: "venue",
  dueDate: plan.event.date,
  priority: "high",
  relatedTaskIds: [],
  assumptions: [],
};
it.each(["", "0", "abc", "1.001", "-5"])(
  "reports and focuses invalid known cost %j without mutating the plan",
  async (value) => {
    const decision = props();
    render(<ScenarioPanel {...decision} />);
    const input = screen.getByLabelText("Minimum known cost");
    fireEvent.change(input, { target: { value } });
    fireEvent.click(
      screen.getByRole("button", { name: "Set category minimum" }),
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Enter a positive INR amount/);
    expect(input).toHaveFocus();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(decision.update).not.toHaveBeenCalled();
    expect(decision.confirm).not.toHaveBeenCalled();
  },
);
it("uses the controlled selected category and clears the error after valid correction", () => {
  render(<ScenarioPanel {...props()} />);
  const input = screen.getByLabelText("Minimum known cost");
  fireEvent.click(screen.getByRole("button", { name: "Set category minimum" }));
  const category = budgetCategories[plan.event.eventType][1].id;
  fireEvent.change(screen.getByLabelText("Known-cost category"), {
    target: { value: category },
  });
  fireEvent.change(input, { target: { value: "123.45" } });
  fireEvent.click(screen.getByRole("button", { name: "Set category minimum" }));
  expect(input).toHaveAttribute("aria-invalid", "false");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(
    screen.getByText(new RegExp(`${category}: minimum`)),
  ).toHaveTextContent("123.45");
});
it("explains the zero-decimal known-cost requirement for JPY", () => {
  const decision = props();
  decision.workspace.plan = {
    ...plan,
    event: { ...plan.event, currency: "JPY" },
  };
  render(<ScenarioPanel {...decision} />);
  const input = screen.getByLabelText("Minimum known cost");
  fireEvent.change(input, { target: { value: "1.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Set category minimum" }));
  expect(input).toHaveAccessibleDescription(/positive JPY amount/);
});
it.each([
  ["Task title", "", /Too small/],
  ["Proposed deadline", "2020-01-01", /between today and the event date/],
])(
  "associates task validation with %s and focuses it",
  async (label, value, message) => {
    const decision = props();
    render(<TaskEditor initial={draft} props={decision} close={vi.fn()} />);
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Review task change" }));
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(message);
    expect(decision.confirm).not.toHaveBeenCalled();
  },
);
it("focuses and describes an invalid event window before opening a confirmation", async () => {
  const decision = props(),
    { container } = render(<SchedulePanel {...decision} />);
  open(container);
  const end = screen.getByLabelText("Event end time");
  fireEvent.change(end, { target: { value: "08:00" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Load sample day-of schedule" }),
  );
  await waitFor(() => expect(end).toHaveFocus());
  expect(end).toHaveAttribute("aria-invalid", "true");
  expect(end).toHaveAccessibleDescription(/end after the start/);
  expect(decision.confirm).not.toHaveBeenCalled();
});
it("associates schedule activity errors with the original editable row", async () => {
  const decision = props(),
    { container } = render(<SchedulePanel {...decision} />);
  open(container);
  fireEvent.click(
    screen.getByRole("button", { name: "Load sample day-of schedule" }),
  );
  const duration = screen.getByLabelText("Activity 1 duration (minutes)");
  fireEvent.change(duration, { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Save day-of schedule" }));
  await waitFor(() => expect(duration).toHaveFocus());
  expect(duration).toHaveAttribute("aria-invalid", "true");
  expect(duration).toHaveAccessibleDescription(/Too small/);
  expect(decision.confirm).not.toHaveBeenCalled();
});
it.each([false, true])(
  "returns the actual schedule save result (%s) to its confirmation",
  async (saved) => {
    const decision = props(saved),
      { container } = render(<SchedulePanel {...decision} />);
    open(container);
    fireEvent.click(
      screen.getByRole("button", { name: "Load sample day-of schedule" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save day-of schedule" }),
    );
    const confirmation = decision.confirm.mock.calls[0][0];
    expect(await confirmation.action()).toBe(saved);
  },
);

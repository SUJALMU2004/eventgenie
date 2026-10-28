import { budgetCategories } from "@/data/templates";
import { vendorCategories } from "@/data/vendor-categories";
import { today } from "@/lib/dates";
import type { ContingencyInput } from "@/schemas/intelligence";
import type { ScenarioInput } from "@/schemas/finance";
import type { Priority } from "@/schemas/event";
import type { Workspace } from "./workspace";
import type { TaskProposal } from "./task-workflows";

export type ContingencyState = {
  workspace: Workspace;
  input: ContingencyInput;
  scenario: ScenarioInput;
  risks: string[];
  areas: string[];
  actions: string[];
  financial: boolean;
  edit?: TaskProposal;
};
type Rule = (state: ContingencyState, clock: () => Date) => void;
function financialAmount({ input, workspace }: ContingencyState) {
  if (
    !input.amountMinor ||
    input.amountMinor > workspace.plan.event.budgetMinor
  )
    throw new Error(
      "Enter a positive amount no greater than the current budget.",
    );
  return input.amountMinor;
}
function affectedCategory(
  input: ContingencyInput,
  allowed: Priority[],
  message: string,
) {
  if (!input.category || !allowed.includes(input.category))
    throw new Error(message);
  return input.category;
}
const budgetReduction: Rule = (state) => {
  const amount = financialAmount(state);
  if (amount >= state.workspace.plan.event.budgetMinor)
    throw new Error("A reduced budget must remain positive.");
  state.scenario.totalMinor -= amount;
  state.financial = true;
  state.areas.push("budget");
  state.actions.push(
    "Protect existing contracts and paid amounts before simplifying optional spending.",
  );
};
const costIncrease: Rule = (state) => {
  const amount = financialAmount(state);
  const { plan } = state.workspace;
  const category = affectedCategory(
    state.input,
    budgetCategories[plan.event.eventType].map((item) => item.id),
    "Choose an affected budget category.",
  );
  const allocation = plan.budget.find((item) => item.id === category);
  if (!allocation) throw new Error("Choose an affected budget category.");
  state.scenario.knownCosts = [
    { category, minimumMinor: allocation.amountMinor + amount },
  ];
  state.financial = true;
  state.areas.push("budget", "vendors");
  state.actions.push(
    "Obtain a written revised quote and compare optional allocations before committing.",
  );
};
const guestChange: Rule = (state) => {
  const { input, workspace } = state;
  if (
    !input.guests ||
    (input.kind === "guest-increase"
      ? input.guests <= workspace.plan.event.guests
      : input.guests >= workspace.plan.event.guests)
  )
    throw new Error("Enter a changed guest count in the selected direction.");
  state.scenario.guests = input.guests;
  state.financial = true;
  state.areas.push("budget", "vendors", "schedule");
  state.actions.push(
    "Reconfirm capacity, portions and accessibility. Existing contracts do not automatically scale or refund.",
  );
  state.risks.push(
    "No per-guest price or automatic cost saving is assumed; budget allocations are envelopes.",
  );
};
const vendorCancellation: Rule = (state) => {
  affectedCategory(
    state.input,
    vendorCategories(state.workspace.plan.event.eventType).map(
      (item) => item.id,
    ),
    "Choose a supplier category for this event.",
  );
  state.areas.push("vendors", "budget", "timeline");
  state.actions.push(
    "Verify the cancellation, check the actual written contract, and ask alternative suppliers about availability.",
  );
  state.risks.push(
    "No booking is cancelled and no deposit is refunded automatically.",
  );
};
const rainActions = {
  wedding: "Review an indoor ceremony route and dry photography access.",
  birthday: "Prepare an indoor cake and games area.",
  community:
    "Agree sheltered access, safe electrical setup and a volunteer briefing.",
};
const rain: Rule = (state) => {
  state.areas.push("schedule", "vendors", "timeline");
  state.actions.push(rainActions[state.workspace.plan.event.eventType]);
  state.risks.push(
    "Rain is a user-selected hypothetical; no live forecast or venue availability has been checked.",
  );
};
const taskDelay: Rule = (state, clock) => {
  const { input, workspace } = state;
  const task = workspace.plan.tasks.find((item) => item.id === input.taskId);
  const date = input.newDueDate;
  if (
    !task ||
    task.completed ||
    !date ||
    date <= task.dueDate ||
    date < today(clock)
  )
    throw new Error("Select an incomplete task and a later valid deadline.");
  state.areas.push("timeline");
  state.actions.push(
    "Confirm the revised deadline and review downstream prerequisites with the organiser.",
  );
  if (date > workspace.plan.event.date) {
    state.risks.push(
      "Critical: the delayed deadline falls after the event and cannot be applied.",
    );
    return;
  }
  state.edit = {
    taskId: task.id,
    title: task.title,
    reason: task.description,
    category: task.category,
    priority: task.priority,
    dueDate: date,
    relatedTaskIds:
      workspace.enhancements.dependencies.find(
        (edge) => edge.taskId === task.id,
      )?.dependsOn ?? [],
    assumptions: [
      "The organiser must confirm feasibility of the new deadline.",
    ],
  };
};
/** Each disruption owns its validation and consequences; shared finance stays deterministic. */
export const contingencyRules: Record<ContingencyInput["kind"], Rule> = {
  rain,
  "budget-reduction": budgetReduction,
  "cost-increase": costIncrease,
  "guest-increase": guestChange,
  "attendance-drop": guestChange,
  "vendor-cancellation": vendorCancellation,
  "task-delay": taskDelay,
};

/** Follow each dependency edge once to identify downstream preparation tasks. */
export function downstreamTasks(workspace: Workspace, taskId?: string) {
  const affected = new Set<string>(taskId ? [taskId] : []);
  const successors = new Map<string, string[]>();
  for (const edge of workspace.enhancements.dependencies) {
    for (const id of edge.dependsOn) {
      const outgoing = successors.get(id) ?? [];
      outgoing.push(edge.taskId);
      successors.set(id, outgoing);
    }
  }
  const queue = [...affected];
  for (let index = 0; index < queue.length; index++) {
    for (const id of successors.get(queue[index]) ?? []) {
      if (!affected.has(id)) {
        affected.add(id);
        queue.push(id);
      }
    }
  }
  return affected;
}
export function inspectDelayedDependents(
  state: ContingencyState,
  affected: Set<string>,
) {
  const { input } = state;
  const date = input.newDueDate;
  if (input.kind !== "task-delay" || !date) return;
  const conflicts = state.workspace.plan.tasks.filter(
    (task) =>
      task.id !== input.taskId &&
      affected.has(task.id) &&
      !task.completed &&
      task.dueDate < date,
  );
  if (conflicts.length) {
    state.risks.push(
      `Critical: ${conflicts.length} downstream task deadlines precede the proposed prerequisite. Review those deadlines first.`,
    );
    state.edit = undefined;
  }
}

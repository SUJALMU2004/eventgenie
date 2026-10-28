import {
  contingencyInputSchema,
  type ContingencyInput,
} from "@/schemas/intelligence";
import { budgetCategories } from "@/data/templates";
import { vendorCategories } from "@/data/vendor-categories";
import {
  scenarioDefaults,
  simulateScenario,
  financialPosition,
} from "./finance";
import { applyScenario, type Workspace } from "./workspace";
import { applyTaskProposal, type TaskProposal } from "./task-workflows";
import { today, taskDate } from "@/lib/dates";
export function analyzeContingency(
  workspace: Workspace,
  raw: ContingencyInput,
  clock: () => Date = () => new Date(),
) {
  const input = contingencyInputSchema.parse(raw),
    { plan, enhancements } = workspace;
  const scenario = scenarioDefaults(plan, enhancements.contingencyPercent);
  const risks: string[] = [],
    areas: string[] = [],
    actions: string[] = [];
  let financial = false,
    edit: TaskProposal | undefined;
  if (
    ["budget-reduction", "cost-increase"].includes(input.kind) &&
    (!input.amountMinor || input.amountMinor > plan.event.budgetMinor)
  )
    throw new Error(
      "Enter a positive amount no greater than the current budget.",
    );
  if (input.kind === "budget-reduction") {
    if (input.amountMinor! >= plan.event.budgetMinor)
      throw new Error("A reduced budget must remain positive.");
    scenario.totalMinor -= input.amountMinor!;
    financial = true;
    areas.push("budget");
    actions.push(
      "Protect existing contracts and paid amounts before simplifying optional spending.",
    );
  }
  if (input.kind === "cost-increase") {
    if (
      !input.category ||
      !budgetCategories[plan.event.eventType].some(
        (item) => item.id === input.category,
      )
    )
      throw new Error("Choose an affected budget category.");
    const allocation = plan.budget.find(
      (item) => item.id === input.category,
    )!.amountMinor;
    scenario.knownCosts = [
      {
        category: input.category,
        minimumMinor: allocation + input.amountMinor!,
      },
    ];
    financial = true;
    areas.push("budget", "vendors");
    actions.push(
      "Obtain a written revised quote and compare optional allocations before committing.",
    );
  }
  if (input.kind === "guest-increase" || input.kind === "attendance-drop") {
    if (
      !input.guests ||
      (input.kind === "guest-increase"
        ? input.guests <= plan.event.guests
        : input.guests >= plan.event.guests)
    )
      throw new Error("Enter a changed guest count in the selected direction.");
    scenario.guests = input.guests;
    financial = true;
    areas.push("budget", "vendors", "schedule");
    actions.push(
      "Reconfirm capacity, portions and accessibility. Existing contracts do not automatically scale or refund.",
    );
    risks.push(
      "No per-guest price or automatic cost saving is assumed; budget allocations are envelopes.",
    );
  }
  if (input.kind === "vendor-cancellation") {
    if (
      !input.category ||
      !vendorCategories(plan.event.eventType).some(
        (item) => item.id === input.category,
      )
    )
      throw new Error("Choose a supplier category for this event.");
    areas.push("vendors", "budget", "timeline");
    actions.push(
      "Verify the cancellation, check the actual written contract, and ask alternative suppliers about availability.",
    );
    risks.push(
      "No booking is cancelled and no deposit is refunded automatically.",
    );
  }
  if (input.kind === "rain") {
    areas.push("schedule", "vendors", "timeline");
    actions.push(
      plan.event.eventType === "wedding"
        ? "Review an indoor ceremony route and dry photography access."
        : plan.event.eventType === "birthday"
          ? "Prepare an indoor cake and games area."
          : "Agree sheltered access, safe electrical setup and a volunteer briefing.",
    );
    risks.push(
      "Rain is a user-selected hypothetical; no live forecast or venue availability has been checked.",
    );
  }
  if (input.kind === "task-delay") {
    const task = plan.tasks.find((item) => item.id === input.taskId);
    if (
      !task ||
      task.completed ||
      !input.newDueDate ||
      input.newDueDate <= task.dueDate ||
      input.newDueDate < today(clock)
    )
      throw new Error("Select an incomplete task and a later valid deadline.");
    areas.push("timeline");
    actions.push(
      "Confirm the revised deadline and review downstream prerequisites with the organiser.",
    );
    if (input.newDueDate > plan.event.date)
      risks.push(
        "Critical: the delayed deadline falls after the event and cannot be applied.",
      );
    else
      edit = {
        taskId: task.id,
        title: task.title,
        reason: task.description,
        category: task.category,
        priority: task.priority,
        dueDate: input.newDueDate,
        relatedTaskIds:
          enhancements.dependencies.find((edge) => edge.taskId === task.id)
            ?.dependsOn ?? [],
        assumptions: [
          "The organiser must confirm feasibility of the new deadline.",
        ],
      };
  }
  const affectedTasks = new Set<string>(input.taskId ? [input.taskId] : []);
  const successors = new Map<string, string[]>();
  for (const edge of enhancements.dependencies)
    for (const id of edge.dependsOn) {
      const outgoing = successors.get(id) ?? [];
      outgoing.push(edge.taskId);
      successors.set(id, outgoing);
    }
  const queue = [...affectedTasks];
  for (let index = 0; index < queue.length; index++)
    for (const id of successors.get(queue[index]) ?? [])
      if (!affectedTasks.has(id)) {
        affectedTasks.add(id);
        queue.push(id);
      }
  const position = financialPosition(
    // Commitments and linked deposits remain protected in every hypothetical.
    plan,
    enhancements.quotes,
    enhancements.expenses,
  );
  if (input.kind === "task-delay" && input.newDueDate) {
    const conflicts = plan.tasks.filter(
      (task) =>
        task.id !== input.taskId &&
        affectedTasks.has(task.id) &&
        !task.completed &&
        task.dueDate < input.newDueDate!,
    );
    if (conflicts.length) {
      risks.push(
        `Critical: ${conflicts.length} downstream task deadlines precede the proposed prerequisite. Review those deadlines first.`,
      );
      edit = undefined;
    }
  }
  const result = financial
    ? simulateScenario(
        plan,
        scenario,
        enhancements.quotes,
        enhancements.expenses,
      )
    : undefined;
  const title = `Review ${input.kind.replaceAll("-", " ")} contingency`;
  const proposal: TaskProposal = {
    title,
    reason: actions[0],
    category:
      input.category ??
      (plan.event.eventType === "community" ? "logistics" : "venue"),
    dueDate: taskDate(plan.event.date, 3, today(clock)),
    priority: "high",
    relatedTaskIds: [],
    assumptions: [
      "Supplier availability, permissions and contractual terms need confirmation.",
    ],
  };
  return {
    input,
    summary: `Hypothetical ${input.kind.replaceAll("-", " ")} for this ${plan.event.eventType}.`,
    areas,
    actions,
    risks,
    affectedTasks: [...affectedTasks],
    position,
    scenario: financial ? scenario : undefined,
    result,
    edit,
    proposal,
    assumptions: ["Only recorded commitments and paid amounts are known."],
    limitations: [
      "No live weather, supplier availability, local prices or contract terms were checked.",
    ],
  };
}
export function applyContingency(
  workspace: Workspace,
  input: ContingencyInput,
  selection: { financial: boolean; task: boolean; deadline: boolean },
  clock: () => Date = () => new Date(),
): Workspace {
  const analysis = analyzeContingency(workspace, input, clock);
  let next = workspace;
  if (selection.financial) {
    if (!analysis.scenario || !analysis.result?.feasible)
      throw new Error(
        "The proposed financial change is unavailable or infeasible.",
      );
    next = applyScenario(next, {
      id: crypto.randomUUID(),
      planId: next.plan.id,
      name: "Reviewed contingency",
      createdAt: clock().toISOString(),
      input: analysis.scenario,
    });
  }
  if (selection.deadline) {
    if (!analysis.edit)
      throw new Error("No valid deadline change is available.");
    next = applyTaskProposal(next, analysis.edit, clock);
  }
  if (selection.task) next = applyTaskProposal(next, analysis.proposal, clock);
  if (!selection.financial && !selection.task && !selection.deadline)
    throw new Error("Select at least one supported change.");
  return next;
}

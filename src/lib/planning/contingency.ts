import {
  contingencyInputSchema,
  type ContingencyInput,
} from "@/schemas/intelligence";
import {
  scenarioDefaults,
  simulateScenario,
  financialPosition,
} from "./finance";
import { applyScenario, type Workspace } from "./workspace";
import { applyTaskProposal, type TaskProposal } from "./task-workflows";
import { today, taskDate } from "@/lib/dates";
import {
  contingencyRules,
  downstreamTasks,
  inspectDelayedDependents,
  type ContingencyState,
} from "./contingency-rules";
export function analyzeContingency(
  workspace: Workspace,
  raw: ContingencyInput,
  clock: () => Date = () => new Date(),
) {
  const input = contingencyInputSchema.parse(raw),
    { plan, enhancements } = workspace;
  const state: ContingencyState = {
    workspace,
    input,
    scenario: scenarioDefaults(plan, enhancements.contingencyPercent),
    risks: [],
    areas: [],
    actions: [],
    financial: false,
  };
  contingencyRules[input.kind](state, clock);
  const affected = downstreamTasks(workspace, input.taskId);
  inspectDelayedDependents(state, affected);
  const position = financialPosition(
    plan,
    enhancements.quotes,
    enhancements.expenses,
  );
  const result = state.financial
    ? simulateScenario(
        plan,
        state.scenario,
        enhancements.quotes,
        enhancements.expenses,
      )
    : undefined;
  const proposal: TaskProposal = {
    title: "Review " + input.kind.replaceAll("-", " ") + " contingency",
    reason: state.actions[0],
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
    summary:
      "Hypothetical " +
      input.kind.replaceAll("-", " ") +
      " for this " +
      plan.event.eventType +
      ".",
    areas: state.areas,
    actions: state.actions,
    risks: state.risks,
    affectedTasks: [...affected],
    position,
    scenario: state.financial ? state.scenario : undefined,
    result,
    edit: state.edit,
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

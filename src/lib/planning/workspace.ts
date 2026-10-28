import {
  enhancementSchema,
  emptyEnhancements,
  type PlanEnhancements,
} from "@/schemas/enhancements";
import { planSchema, type EventPlan } from "@/schemas/plan";
import { scenarioSchema, type Scenario } from "@/schemas/finance";
import { financialPosition, simulateScenario } from "./finance";
import { inspectDependencies } from "./dependencies";
import { validateSchedule } from "./schedule";
import { formatDate } from "@/lib/dates";
import {
  type OperationOutput,
  type RefinementAction,
} from "@/schemas/operations";
export type Workspace = { plan: EventPlan; enhancements: PlanEnhancements };
export function validateWorkspace(
  planValue: EventPlan,
  raw: PlanEnhancements,
): Workspace {
  const plan = planSchema.parse(planValue),
    enhancements = enhancementSchema.parse(raw);
  if (enhancements.planId !== plan.id)
    throw new Error("Planning records belong to a different event");
  financialPosition(plan, enhancements.quotes, enhancements.expenses);
  if (
    new Set(enhancements.scenarios.map((item) => item.id)).size !==
      enhancements.scenarios.length ||
    new Set(enhancements.adoptedRescue.map((item) => item.recommendationId))
      .size !== enhancements.adoptedRescue.length
  )
    throw new Error("Duplicate decision record IDs");
  for (const scenario of enhancements.scenarios) {
    scenarioSchema.parse(scenario);
    if (scenario.planId !== plan.id)
      throw new Error("Scenario belongs to a different plan");
    simulateScenario(
      plan,
      scenario.input,
      enhancements.quotes,
      enhancements.expenses,
    );
  }
  inspectDependencies(plan, enhancements.dependencies);
  if (enhancements.schedule) validateSchedule(plan, enhancements.schedule);
  return { plan, enhancements };
}
export function decodeEnhancements(
  raw: unknown,
  plan: EventPlan,
): PlanEnhancements {
  if (raw === undefined) return emptyEnhancements(plan.id);
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("version" in raw) ||
    raw.version !== 2 ||
    !("data" in raw)
  )
    throw new Error(
      "Unsupported planning record version. The original record has not been changed.",
    );
  return validateWorkspace(plan, enhancementSchema.parse(raw.data))
    .enhancements;
}
export function applyScenario(
  workspace: Workspace,
  scenario: Scenario,
): Workspace {
  if (scenario.planId !== workspace.plan.id)
    throw new Error("Scenario belongs to a different event");
  const result = simulateScenario(
    workspace.plan,
    scenario.input,
    workspace.enhancements.quotes,
    workspace.enhancements.expenses,
  );
  if (!result.feasible)
    throw new Error(
      "This scenario is infeasible. Existing commitments must be honoured.",
    );
  const plan = {
    ...workspace.plan,
    event: {
      ...workspace.plan.event,
      budgetMinor: scenario.input.totalMinor,
      guests: scenario.input.guests,
      priorities: [...scenario.input.priorities],
    },
    budget: result.allocations,
    fingerprint: `scenario-applied:${scenario.id}`,
  };
  return validateWorkspace(plan, {
    ...workspace.enhancements,
    contingencyPercent: scenario.input.contingencyPercent,
    cache: [],
  });
}
export function applyRefinement(
  workspace: Workspace,
  action: RefinementAction,
  output: OperationOutput,
): Workspace {
  const invitations =
    action === "formal-invitation" || action === "playful-invitation";
  if (invitations && output.kind === "invitations")
    return validateWorkspace(
      {
        ...workspace.plan,
        invitations: output.invitations.map((text) =>
          text
            .replaceAll("[event title]", workspace.plan.event.title)
            .replaceAll("[date]", formatDate(workspace.plan.event.date))
            .replaceAll("[location]", workspace.plan.event.city),
        ),
      },
      { ...workspace.enhancements, cache: [] },
    );
  if (!invitations && action !== "children-schedule" && output.kind === "ideas")
    return validateWorkspace(
      { ...workspace.plan, ideas: output.ideas },
      { ...workspace.enhancements, cache: [] },
    );
  throw new Error("This action cannot modify the proposed target field");
}

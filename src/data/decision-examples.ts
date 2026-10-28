import { vendorCategories } from "./vendor-categories";
import { exampleSchedule } from "@/lib/planning/schedule";
import { scenarioDefaults } from "@/lib/planning/finance";
import type { Workspace } from "@/lib/planning/workspace";
export function addDecisionExamples(
  workspace: Workspace,
  clock: () => Date = () => new Date(),
): Workspace {
  const { plan, enhancements } = workspace;
  if (
    enhancements.quotes.length ||
    enhancements.expenses.length ||
    enhancements.schedule
  )
    throw new Error(
      "Examples can only be added to an empty decision workspace.",
    );
  if (enhancements.scenarios.length >= 30)
    throw new Error(
      "Remove one saved scenario before adding example decisions.",
    );
  const category = vendorCategories(plan.event.eventType)[0].id,
    quoteId = crypto.randomUUID(),
    commitmentMinor = Math.max(1, Math.floor(plan.event.budgetMinor / 10));
  return {
    ...workspace,
    enhancements: {
      ...enhancements,
      quotes: [
        {
          id: quoteId,
          planId: plan.id,
          category,
          displayName: "Sample option A — fictional",
          quotedMinor: commitmentMinor,
          commitmentMinor,
          booking: "booked",
          availability: "unknown",
          quoteStatus: "estimate",
          notes:
            "Illustrative example only. No business or availability has been verified.",
          inclusions: ["Example setup support"],
          source: "demo",
        },
        {
          id: crypto.randomUUID(),
          planId: plan.id,
          category,
          displayName: "Sample option B — fictional",
          quotedMinor:
            commitmentMinor + Math.max(1, Math.floor(commitmentMinor / 5)),
          commitmentMinor: 0,
          booking: "considering",
          availability: "unknown",
          quoteStatus: "estimate",
          notes: "Illustrative example only.",
          inclusions: [],
          source: "demo",
        },
      ],
      expenses: [
        {
          id: crypto.randomUUID(),
          planId: plan.id,
          category,
          label: "Sample deposit — fictional",
          amountMinor: Math.max(1, Math.floor(commitmentMinor / 5)),
          vendorQuoteId: quoteId,
        },
      ],
      scenarios: [
        ...enhancements.scenarios,
        {
          id: crypto.randomUUID(),
          planId: plan.id,
          name: "Sample 15% budget reduction — preview",
          createdAt: clock().toISOString(),
          input: {
            ...scenarioDefaults(plan, enhancements.contingencyPercent),
            totalMinor: Math.max(
              1,
              Math.floor((plan.event.budgetMinor * 85) / 100),
            ),
          },
        },
      ],
      schedule: exampleSchedule(
        plan.event.eventType,
        { startMinute: 540, endMinute: 1020, timeZone: "Asia/Kolkata" },
        clock,
      ),
    },
  };
}

"use client";
import { useMemo, useState } from "react";
import { assessQuote } from "@/lib/planning/finance";
import { applyScenario } from "@/lib/planning/workspace";
import { formatMoney } from "@/features/budget/engine";
import { Button } from "@/components/ui/button";
import { ScenarioComparison } from "./scenario-comparison";
import type { DecisionProps } from "./types";
export function QuoteRescue({
  workspace,
  update,
  confirm,
  busy,
}: DecisionProps) {
  const { plan, enhancements } = workspace;
  const [selection, setSelection] = useState("");
  const quoteId = enhancements.quotes.some((item) => item.id === selection)
    ? selection
    : enhancements.quotes[0]?.id;
  const assessment = useMemo(
    () =>
      quoteId
        ? assessQuote(
            plan,
            enhancements.quotes,
            enhancements.expenses,
            quoteId,
            enhancements.contingencyPercent,
          )
        : undefined,
    [plan, enhancements, quoteId],
  );
  if (!assessment)
    return (
      <p className="notice">
        Add a quote in Vendor Decision Desk to assess an unexpected price change
        without booking it.
      </p>
    );
  return (
    <div className="quote-rescue">
      <h3>Unexpected quote impact</h3>
      <label className="standalone-label no-print">
        Quote to assess
        <select
          value={quoteId}
          onChange={(event) => setSelection(event.target.value)}
        >
          {enhancements.quotes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName}
            </option>
          ))}
        </select>
      </label>
      <p className="small-text">
        Keeping other planned allocations and protecting all recorded costs
        would require{" "}
        {formatMoney(assessment.projectedMinor, plan.event.currency)} in total:{" "}
        {formatMoney(assessment.pressureMinor, plan.event.currency)} above the
        current budget. This is a projection from entered figures, not a
        supplier quote or actual spend.
      </p>
      <p className={assessment.result.feasible ? "notice" : "error-notice"}>
        {assessment.result.feasible
          ? "A calculated rebalance can accommodate this quote."
          : `Infeasible: ${formatMoney(assessment.result.shortfallMinor, plan.event.currency)} more is needed while protecting commitments and contingency.`}{" "}
        The quote remains unbooked unless you change its booking status
        separately.
      </p>
      <ScenarioComparison
        result={assessment.result}
        currency={plan.event.currency}
      />
      <Button
        disabled={busy || !assessment.result.feasible}
        variant="secondary"
        onClick={() =>
          confirm({
            title: "Apply this quote-aware rebalance?",
            description:
              "Allocations will reserve room for this entered quote. No booking is made, paid amounts are preserved and existing contractual commitments cannot be reduced.",
            action: () =>
              update((current) => {
                const fresh = assessQuote(
                  current.plan,
                  current.enhancements.quotes,
                  current.enhancements.expenses,
                  assessment.quote.id,
                  current.enhancements.contingencyPercent,
                );
                return applyScenario(current, {
                  id: crypto.randomUUID(),
                  planId: current.plan.id,
                  name: "Quote recovery",
                  createdAt: new Date().toISOString(),
                  input: fresh.input,
                });
              }),
          })
        }
      >
        Review quote recovery
      </Button>
    </div>
  );
}

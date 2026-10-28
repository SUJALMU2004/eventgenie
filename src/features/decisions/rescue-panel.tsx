"use client";
import { useMemo } from "react";
import {
  financialPosition,
  recoveryOptions,
  simulateScenario,
} from "@/lib/planning/finance";
import { applyScenario } from "@/lib/planning/workspace";
import { formatMoney } from "@/features/budget/engine";
import { Button } from "@/components/ui/button";
import { DecisionPanel, type DecisionProps } from "./types";
import { PaymentRecords } from "./payments";
import { AIWorkbench } from "./ai-workbench";
import { QuoteRescue } from "./quote-rescue";
export function RescuePanel(props: DecisionProps) {
  const { workspace, update, confirm, busy } = props,
    { plan, enhancements } = workspace;
  const position = useMemo(
    () => financialPosition(plan, enhancements.quotes, enhancements.expenses),
    [plan, enhancements.quotes, enhancements.expenses],
  );
  const money = (value: number) => formatMoney(value, plan.event.currency);
  const options = recoveryOptions(
    plan,
    enhancements.quotes,
    enhancements.expenses,
    enhancements.contingencyPercent,
  );
  return (
    <DecisionPanel
      id="budget-rescue"
      title="Budget Rescue"
      description="A clear view of commitments, payments and the room still available."
    >
      <dl className="financial-summary">
        {[
          ["Available budget", plan.event.budgetMinor],
          ["Contractually committed", position.contractualMinor],
          ["Actually paid", position.paidMinor],
          ["Protected total (no double-counting)", position.protectedMinor],
          [
            "Remaining contractual / paid obligations",
            position.outstandingMinor,
          ],
          ["Uncommitted funds before contingency", position.uncommittedMinor],
          ["Shortfall before contingency", position.shortfallMinor],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{money(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <p className="small-text muted">
        A quote is not a commitment. Protected costs use the larger of each
        vendor’s contractual commitment or linked payments, plus independent
        payments. The What-If comparison additionally protects the selected
        contingency.
      </p>
      <QuoteRescue {...props} />
      <h3>Calculated recovery options</h3>
      <div className="rescue-options">
        {options.map((option) => {
          const result = simulateScenario(
            plan,
            option.input,
            enhancements.quotes,
            enhancements.expenses,
          );
          return (
            <article key={option.name}>
              <h4>{option.name}</h4>
              <p>
                {result.feasible
                  ? "Arithmetically feasible"
                  : `Infeasible: ${money(result.shortfallMinor)} short`}{" "}
                · budget {money(option.input.totalMinor)} · reserve{" "}
                {option.input.contingencyPercent}%
              </p>
              <Button
                size="small"
                variant="secondary"
                disabled={busy || !result.feasible}
                onClick={() =>
                  confirm({
                    title: "Apply this calculated recovery?",
                    description: `${option.name}. Budget ${money(option.input.totalMinor)}; reserve ${option.input.contingencyPercent}%. Commitments and paid amounts remain protected. A zero reserve increases exposure to unexpected costs.`,
                    action: () =>
                      update((current) =>
                        applyScenario(current, {
                          id: crypto.randomUUID(),
                          planId: plan.id,
                          name: option.name,
                          createdAt: new Date().toISOString(),
                          input: option.input,
                        }),
                      ),
                  })
                }
              >
                Review {option.name}
              </Button>
            </article>
          );
        })}
      </div>
      <PaymentRecords {...props} />
      <AIWorkbench {...props} operation="rescue-ideas" />
      {enhancements.adoptedRescue.length ? (
        <div>
          <h3>Adopted qualitative ideas</h3>
          <ul>
            {enhancements.adoptedRescue.map((item) => (
              <li key={item.recommendationId}>
                {item.title} · {item.explanation}{" "}
                <strong>No monetary saving has been booked.</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DecisionPanel>
  );
}

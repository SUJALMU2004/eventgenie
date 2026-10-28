"use client";
import { useMemo, useState } from "react";
import { DecisionPanel, type DecisionProps } from "@/features/decisions/types";
import { compareScenarios } from "@/lib/planning/comparison";
import { applyScenario } from "@/lib/planning/workspace";
import { formatMoney } from "@/features/budget/engine";
import { Button } from "@/components/ui/button";
export function ComparisonPanel(props: DecisionProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const comparison = useMemo(() => {
    try {
      return { data: compareScenarios(props.workspace, selected), error: "" };
    } catch (error) {
      return {
        data: undefined,
        error:
          error instanceof Error
            ? error.message
            : "Could not compare scenarios.",
      };
    }
  }, [props.workspace, selected]);
  const money = (value: number) =>
      formatMoney(value, props.workspace.plan.event.currency),
    data = comparison.data;
  return (
    <DecisionPanel
      id="compare-strategies"
      title="Compare your strategies"
      description="Current plan plus up to three saved alternatives. Calculations do not change your plan."
    >
      <fieldset>
        <legend>Saved alternatives to compare</legend>
        {props.workspace.enhancements.scenarios.length ? (
          props.workspace.enhancements.scenarios.map((item) => (
            <label className="check-label" key={item.id}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={!selected.includes(item.id) && selected.length === 3}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  )
                }
              />
              {item.name}
            </label>
          ))
        ) : (
          <p>
            Save an alternative in What-If first. The current plan remains the
            baseline.
          </p>
        )}
      </fieldset>
      {comparison.error ? (
        <p role="alert">
          {comparison.error}{" "}
          <Button onClick={() => setSelected([])}>Reset comparison</Button>
        </p>
      ) : null}
      {data ? (
        <>
          <p className="small-text">
            All amounts use {props.workspace.plan.event.currency}; no
            conversion. Scroll the table horizontally on small screens. Lowest
            budget is a calculation, not a recommendation.
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable strategy comparison"
          >
            <table className="strategy-table">
              <caption>Planning strategy comparison</caption>
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  {data.columns.map((column) => (
                    <th scope="col" key={column.id}>
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Budget",
                    (c: (typeof data.columns)[number]) =>
                      money(c.totalMinor) +
                      (c.totalMinor === data.lowestBudget
                        ? " · Lowest budget"
                        : ""),
                  ],
                  [
                    "Guests",
                    (c: (typeof data.columns)[number]) => String(c.guests),
                  ],
                  [
                    "Contingency",
                    (c: (typeof data.columns)[number]) =>
                      money(c.contingencyMinor) +
                      (c.contingencyMinor === data.highestReserve
                        ? " · Highest reserve"
                        : ""),
                  ],
                  ["Paid expenses", () => money(data.finance.paidMinor)],
                  [
                    "Booked commitments",
                    () => money(data.finance.contractualMinor),
                  ],
                  [
                    "Protected costs including paid amounts",
                    () => money(data.finance.protectedMinor),
                  ],
                  [
                    "Uncommitted funds after reserve",
                    (c: (typeof data.columns)[number]) =>
                      money(c.availableMinor),
                  ],
                  [
                    "Feasibility",
                    (c: (typeof data.columns)[number]) =>
                      c.feasible
                        ? "Feasible against recorded costs"
                        : `Critical shortfall: ${money(c.shortfallMinor)}`,
                  ],
                  [
                    "Outstanding tasks",
                    () =>
                      String(data.outstanding) + " · no automatic rescheduling",
                  ],
                  [
                    "Priorities",
                    (c: (typeof data.columns)[number]) =>
                      c.priorities.join(", ") || "Balanced",
                  ],
                  [
                    "Planning risks",
                    () =>
                      `${data.readiness.findings.filter((item) => item.severity === "critical").length} current critical findings; review supplier capacity if guests change`,
                  ],
                  [
                    "Vendor requirements",
                    () =>
                      "Existing bookings retained; no availability or refund assumed",
                  ],
                ].map(([label, render]) => (
                  <tr key={String(label)}>
                    <th scope="row">{String(label)}</th>
                    {data.columns.map((c) => (
                      <td key={c.id}>
                        {typeof render === "function" ? render(c) : ""}
                      </td>
                    ))}
                  </tr>
                ))}
                {props.workspace.plan.budget.map((category) => (
                  <tr key={category.id}>
                    <th scope="row">{category.label}</th>
                    {data.columns.map((c) => {
                      const amount =
                          c.allocations.find((item) => item.id === category.id)
                            ?.amountMinor ?? 0,
                        difference = amount - category.amountMinor;
                      return (
                        <td key={c.id}>
                          {money(amount)}
                          {difference !== 0 ? (
                            <small className="comparison-difference">
                              {difference > 0 ? "+" : ""}
                              {money(difference)}
                              {Math.abs(difference) * 5 >= category.amountMinor
                                ? " · Major allocation change"
                                : ""}
                            </small>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            {data.columns.slice(1).map((column) => (
              <Button
                key={column.id}
                disabled={props.busy || !column.feasible}
                onClick={() =>
                  props.confirm({
                    title: `Apply ${column.name}?`,
                    description:
                      "Only budget, guest count, priorities and contingency change. Contracts, paid expenses, completed tasks and event facts stay recorded. This change can be undone.",
                    action: () =>
                      props.update((current) => {
                        const scenario = current.enhancements.scenarios.find(
                          (item) => item.id === column.id,
                        );
                        if (!scenario)
                          throw new Error("This scenario is no longer saved.");
                        return applyScenario(current, scenario);
                      }, "Apply compared scenario"),
                  })
                }
              >
                Apply {column.name}
              </Button>
            ))}
          </div>
        </>
      ) : null}
    </DecisionPanel>
  );
}

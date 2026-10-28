"use client";
import { useId, useMemo, useRef, useState } from "react";
import { ScenarioComparison } from "./scenario-comparison";
import { Button } from "@/components/ui/button";
import { budgetCategories } from "@/data/templates";
import { formatMoney, moneyInput, parseMoney } from "@/features/budget/engine";
import { scenarioDefaults, simulateScenario } from "@/lib/planning/finance";
import { applyScenario } from "@/lib/planning/workspace";
import type { Scenario, ScenarioInput } from "@/schemas/finance";
import { DecisionPanel, type DecisionProps } from "./types";
import { prioritySchema } from "@/schemas/event";
export function ScenarioPanel({
  workspace,
  update,
  confirm,
  busy,
}: DecisionProps) {
  const { plan, enhancements } = workspace;
  const [input, setInput] = useState(() =>
    scenarioDefaults(plan, enhancements.contingencyPercent),
  );
  const [budgetText, setBudgetText] = useState(() =>
      moneyInput(plan.event.budgetMinor, plan.event.currency),
    ),
    [name, setName] = useState("My scenario");
  const [knownCategory, setKnownCategory] = useState(
    budgetCategories[plan.event.eventType][0].id,
  );
  const [knownCost, setKnownCost] = useState("");
  const [knownCostError, setKnownCostError] = useState("");
  const knownCostRef = useRef<HTMLInputElement>(null);
  const knownCostId = useId();
  const result = useMemo(() => {
    try {
      return {
        value: simulateScenario(
          plan,
          input,
          enhancements.quotes,
          enhancements.expenses,
        ),
        error: "",
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Check your scenario inputs.",
      };
    }
  }, [plan, input, enhancements.quotes, enhancements.expenses]);
  const money = (amount: number) => formatMoney(amount, plan.event.currency);
  function reset() {
    setInput(scenarioDefaults(plan, enhancements.contingencyPercent));
    setBudgetText(moneyInput(plan.event.budgetMinor, plan.event.currency));
  }
  function preset(change: Partial<ScenarioInput>) {
    const next = {
      ...scenarioDefaults(plan, enhancements.contingencyPercent),
      ...change,
    };
    setInput(next);
    setBudgetText(moneyInput(next.totalMinor, plan.event.currency));
  }
  function record(): Scenario {
    return {
      id: crypto.randomUUID(),
      planId: plan.id,
      name: name.trim() || "My scenario",
      createdAt: new Date().toISOString(),
      input,
    };
  }
  function setCategoryMinimum() {
    const minimumMinor = parseMoney(knownCost, plan.event.currency);
    if (minimumMinor === null) {
      setKnownCostError(
        `Enter a positive ${plan.event.currency} amount using the currency's supported decimal precision.`,
      );
      knownCostRef.current?.focus();
      return;
    }
    setKnownCostError("");
    setInput((current) => ({
      ...current,
      knownCosts: [
        ...current.knownCosts.filter((item) => item.category !== knownCategory),
        { category: knownCategory, minimumMinor },
      ],
    }));
  }
  return (
    <DecisionPanel
      id="what-if"
      title="What-If Simulator"
      description="Explore changes first. Your active plan stays unchanged until you confirm."
      open
      printable={false}
    >
      <div className="preset-buttons no-print">
        <Button
          size="small"
          variant="secondary"
          onClick={() =>
            preset({
              totalMinor: Math.max(
                1,
                Math.floor((plan.event.budgetMinor * 85) / 100),
              ),
            })
          }
        >
          Budget −15%
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() =>
            preset({
              guests: Math.min(
                10000,
                Math.ceil((plan.event.guests * 120) / 100),
              ),
            })
          }
        >
          Guests +20%
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() => preset({ contingencyPercent: 15 })}
        >
          15% reserve
        </Button>
        <Button size="small" variant="ghost" onClick={reset}>
          Reset scenario
        </Button>
      </div>
      <div className="form-grid">
        <label>
          Scenario budget ({plan.event.currency})
          <input
            aria-label="Scenario budget"
            inputMode="decimal"
            value={budgetText}
            onChange={(event) => {
              setBudgetText(event.target.value);
              setInput((current) => ({
                ...current,
                totalMinor:
                  parseMoney(event.target.value, plan.event.currency) ?? 0,
              }));
            }}
          />
        </label>
        <label>
          Scenario guest count
          <input
            type="number"
            min={1}
            max={10000}
            value={input.guests}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                guests: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="field-wide">
          Contingency reserve: {input.contingencyPercent}%
          <input
            aria-label="Contingency percentage"
            type="range"
            min={0}
            max={50}
            step={1}
            value={input.contingencyPercent}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                contingencyPercent: Number(event.target.value),
              }))
            }
          />
        </label>
        <fieldset className="priority-options field-wide">
          <legend>Scenario spending priorities (up to 3)</legend>
          <div>
            {budgetCategories[plan.event.eventType].map((category) => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  checked={input.priorities.includes(category.id)}
                  disabled={
                    !input.priorities.includes(category.id) &&
                    input.priorities.length >= 3
                  }
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      priorities: event.target.checked
                        ? [...current.priorities, category.id]
                        : current.priorities.filter((id) => id !== category.id),
                    }))
                  }
                />
                {category.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Known-cost category
          <select
            value={knownCategory}
            onChange={(event) =>
              setKnownCategory(prioritySchema.parse(event.target.value))
            }
          >
            {budgetCategories[plan.event.eventType].map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <form
          className="known-cost-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setCategoryMinimum();
          }}
        >
          <label>
            Minimum known cost
            <input
              id={knownCostId}
              ref={knownCostRef}
              name="cost"
              inputMode="decimal"
              required
              value={knownCost}
              aria-invalid={Boolean(knownCostError)}
              aria-describedby={
                knownCostError ? `${knownCostId}-error` : undefined
              }
              onChange={(event) => {
                setKnownCost(event.target.value);
                setKnownCostError("");
              }}
            />
          </label>
          {knownCostError ? (
            <p id={`${knownCostId}-error`} role="alert" className="field-error">
              {knownCostError}
            </p>
          ) : null}
          <Button size="small" variant="secondary" type="submit">
            Set category minimum
          </Button>
        </form>
      </div>
      <p className="small-text muted">
        Category minima include existing commitments and paid amounts; they are
        not added twice. Quotes remain estimates until you explicitly record a
        commitment.
      </p>
      {input.knownCosts.map((cost) => (
        <p className="small-text" key={cost.category}>
          {cost.category}: minimum {money(cost.minimumMinor)}{" "}
          <Button
            size="small"
            variant="ghost"
            onClick={() =>
              setInput((current) => ({
                ...current,
                knownCosts: current.knownCosts.filter(
                  (item) => item.category !== cost.category,
                ),
              }))
            }
          >
            Remove minimum for {cost.category}
          </Button>
        </p>
      ))}
      {result.error ? (
        <p role="alert" className="error-notice">
          {result.error}
        </p>
      ) : null}
      {result.value ? (
        <>
          <p className={result.value.feasible ? "notice" : "error-notice"}>
            <strong>
              {result.value.feasible ? "Arithmetically feasible" : "Infeasible"}
            </strong>{" "}
            · Original {money(plan.event.budgetMinor)} → simulated{" "}
            {money(input.totalMinor)}.{" "}
            {result.value.shortfallMinor
              ? `Shortfall including protected reserve: ${money(result.value.shortfallMinor)}.`
              : `Contingency: ${money(result.value.contingencyMinor)}.`}{" "}
            Supplier prices and event feasibility still need verification.
          </p>
          <ScenarioComparison
            result={result.value}
            currency={plan.event.currency}
          />
          <ul className="small-text">
            {result.value.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="form-grid">
        <label>
          Scenario name
          <input
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="action-row">
          <Button
            disabled={busy || !result.value}
            variant="secondary"
            onClick={() => {
              const scenario = record();
              void update((current) => ({
                ...current,
                enhancements: {
                  ...current.enhancements,
                  scenarios: [...current.enhancements.scenarios, scenario],
                },
              }));
            }}
          >
            Save scenario
          </Button>
          <Button
            disabled={busy || !result.value?.feasible}
            onClick={() => {
              const scenario = record();
              confirm({
                title: "Apply this scenario?",
                description: `Budget becomes ${money(input.totalMinor)}, guests become ${input.guests}, and contingency becomes ${input.contingencyPercent}%. Completed tasks, vendor decisions and payments are preserved. Existing AI ideas may need review.`,
                action: () =>
                  update((current) => applyScenario(current, scenario)),
              });
            }}
          >
            Apply Scenario
          </Button>
        </div>
      </div>
      <h3>Saved scenarios</h3>
      {enhancements.scenarios.length ? (
        <ul className="saved-scenarios">
          {enhancements.scenarios.map((scenario) => (
            <li key={scenario.id}>
              <span>
                {scenario.name} · {money(scenario.input.totalMinor)} ·{" "}
                {scenario.input.guests} guests
              </span>
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  setInput(scenario.input);
                  setBudgetText(
                    moneyInput(scenario.input.totalMinor, plan.event.currency),
                  );
                  setName(scenario.name);
                }}
              >
                Preview {scenario.name}
              </Button>
              <Button
                size="small"
                variant="ghost"
                onClick={() =>
                  confirm({
                    title: "Delete saved scenario?",
                    description:
                      "Only this preview record will be removed. The active plan is unchanged.",
                    action: () =>
                      update((current) => ({
                        ...current,
                        enhancements: {
                          ...current.enhancements,
                          scenarios: current.enhancements.scenarios.filter(
                            (item) => item.id !== scenario.id,
                          ),
                        },
                      })),
                  })
                }
              >
                Delete {scenario.name}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No scenarios saved.</p>
      )}
    </DecisionPanel>
  );
}

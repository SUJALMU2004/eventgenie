import {
  contingencyKinds,
  type ContingencyInput,
} from "@/schemas/intelligence";
import { budgetCategories } from "@/data/templates";
import { vendorCategories } from "@/data/vendor-categories";
import { formatMoney } from "@/features/budget/engine";
import type { EventPlan } from "@/schemas/plan";
import type { analyzeContingency } from "@/lib/planning/contingency";
import type { useContingency } from "./use-contingency";
export function ContingencyInputs({
  plan,
  controls,
}: {
  plan: EventPlan;
  controls: ReturnType<typeof useContingency>;
}) {
  const {
    kind,
    setKind,
    amount,
    setAmount,
    guests,
    setGuests,
    category,
    setCategory,
    taskId,
    setTaskId,
    date,
    setDate,
    edit,
  } = controls;
  return (
    <div className="form-grid">
      <label>
        Contingency type
        <select
          value={kind}
          onChange={(e) =>
            edit(() => setKind(e.target.value as ContingencyInput["kind"]))
          }
        >
          {contingencyKinds.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("-", " ")}
            </option>
          ))}
        </select>
      </label>
      {["budget-reduction", "cost-increase"].includes(kind) ? (
        <label>
          {kind === "budget-reduction"
            ? "Amount to reduce"
            : "Additional category cost"}{" "}
          ({plan.event.currency})
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => edit(() => setAmount(e.target.value))}
          />
        </label>
      ) : null}
      {["guest-increase", "attendance-drop"].includes(kind) ? (
        <label>
          Proposed total guest count
          <input
            type="number"
            min={1}
            max={10000}
            value={guests}
            onChange={(e) => edit(() => setGuests(e.target.value))}
          />
        </label>
      ) : null}
      {["vendor-cancellation", "cost-increase"].includes(kind) ? (
        <label>
          Affected category
          <select
            value={category}
            onChange={(e) =>
              edit(() => setCategory(e.target.value as typeof category))
            }
          >
            {(kind === "vendor-cancellation"
              ? vendorCategories(plan.event.eventType)
              : budgetCategories[plan.event.eventType]
            ).map((item) => (
              <option key={item.id} value={item.id}>
                {"label" in item ? item.label : item.category}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === "task-delay" ? (
        <>
          <label>
            Delayed task
            <select
              value={taskId}
              onChange={(e) => edit(() => setTaskId(e.target.value))}
            >
              {plan.tasks
                .filter((task) => !task.completed)
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Later proposed deadline
            <input
              type="date"
              value={date}
              onChange={(e) => edit(() => setDate(e.target.value))}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
export function ContingencyFacts({
  plan,
  analysis,
}: {
  plan: EventPlan;
  analysis: ReturnType<typeof analyzeContingency>;
}) {
  return (
    <dl className="fact-grid">
      <dt>Current budget</dt>
      <dd>{formatMoney(plan.event.budgetMinor, plan.event.currency)}</dd>
      <dt>Proposed budget</dt>
      <dd>
        {formatMoney(
          analysis.scenario?.totalMinor ?? plan.event.budgetMinor,
          plan.event.currency,
        )}
      </dd>
      <dt>Current / proposed guests</dt>
      <dd>
        {plan.event.guests} → {analysis.scenario?.guests ?? plan.event.guests}
      </dd>
      <dt>Protected commitments and paid amounts</dt>
      <dd>
        {formatMoney(analysis.position.protectedMinor, plan.event.currency)}
      </dd>
      <dt>Financial feasibility</dt>
      <dd>
        {analysis.result
          ? analysis.result.feasible
            ? "Feasible against recorded costs"
            : `Critical shortfall: ${formatMoney(analysis.result.shortfallMinor, plan.event.currency)}`
          : "No financial record changes proposed"}
      </dd>
    </dl>
  );
}

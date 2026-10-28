"use client";
import { useState } from "react";
import {
  contingencyKinds,
  type ContingencyInput,
} from "@/schemas/intelligence";
import {
  analyzeContingency,
  applyContingency,
} from "@/lib/planning/contingency";
import { historySnapshot } from "@/lib/history";
import { budgetCategories } from "@/data/templates";
import { vendorCategories } from "@/data/vendor-categories";
import { formatMoney, moneyInput, parseMoney } from "@/features/budget/engine";
import { DecisionPanel, type DecisionProps } from "@/features/decisions/types";
import { Button } from "@/components/ui/button";
import { useIntelligence } from "@/features/intelligence/use-intelligence";
import { AIControls } from "@/features/intelligence/ai-controls";
import { IntelligencePreview } from "@/features/intelligence/preview";
import { TaskEditor } from "@/features/tasks/task-editor";
import type { TaskProposal } from "@/lib/planning/task-workflows";
export function ContingencyPanel(props: DecisionProps) {
  const { plan } = props.workspace;
  const [kind, setKind] = useState<ContingencyInput["kind"]>("rain"),
    [amount, setAmount] = useState(
      moneyInput(
        Number(BigInt(plan.event.budgetMinor) / 10n),
        plan.event.currency,
      ),
    ),
    [guests, setGuests] = useState(String(plan.event.guests + 10)),
    [category, setCategory] = useState<
      NonNullable<ContingencyInput["category"]>
    >(budgetCategories[plan.event.eventType][0].id),
    [taskId, setTaskId] = useState(
      plan.tasks.find((task) => !task.completed)?.id ?? "",
    ),
    [date, setDate] = useState(plan.event.date),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<{
      analysis: ReturnType<typeof analyzeContingency>;
      baseline: string;
    }>(),
    [selection, setSelection] = useState({
      financial: false,
      task: false,
      deadline: false,
    }),
    [draft, setDraft] = useState<TaskProposal>();
  const ai = useIntelligence(props, {
    operation: "contingency-playbook",
    contingency: preview?.analysis.input ?? { kind: "rain" },
  });
  function analyze() {
    try {
      const input: ContingencyInput = {
        kind,
        ...(["budget-reduction", "cost-increase"].includes(kind)
          ? { amountMinor: parseMoney(amount, plan.event.currency) ?? 0 }
          : {}),
        ...(["guest-increase", "attendance-drop"].includes(kind)
          ? { guests: Number(guests) }
          : {}),
        ...(["vendor-cancellation", "cost-increase"].includes(kind)
          ? { category }
          : {}),
        ...(kind === "task-delay" ? { taskId, newDueDate: date } : {}),
      };
      setPreview({
        analysis: analyzeContingency(props.workspace, input),
        baseline: JSON.stringify(historySnapshot(props.workspace)),
      });
      setSelection({ financial: false, task: false, deadline: false });
      setError("");
    } catch (value) {
      setPreview(undefined);
      setError(
        value instanceof Error ? value.message : "Check contingency inputs.",
      );
    }
  }
  function edit(action: () => void) {
    action();
    setPreview(undefined);
  }
  const analysis = preview?.analysis;
  return (
    <DecisionPanel
      id="contingency-planner"
      title="Prepare a thoughtful Plan B"
      description="Seven hypothetical disruptions. Calculate impact locally, then review optional AI alternatives."
    >
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
      <Button onClick={analyze}>Analyze contingency impact</Button>
      {error ? (
        <p role="alert" className="error-notice">
          {error}
        </p>
      ) : null}
      {analysis ? (
        <div className="contingency-preview">
          <h3>Before → proposed change</h3>
          <p>{analysis.summary}</p>
          <p>
            Affected sections: {analysis.areas.join(", ")}. Downstream tasks
            affected: {analysis.affectedTasks.length}.
          </p>
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
              {plan.event.guests} →{" "}
              {analysis.scenario?.guests ?? plan.event.guests}
            </dd>
            <dt>Protected commitments and paid amounts</dt>
            <dd>
              {formatMoney(
                analysis.position.protectedMinor,
                plan.event.currency,
              )}
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
          <h4>Immediate actions</h4>
          <ul>
            {analysis.actions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {analysis.risks.length ? (
            <div className="error-notice">
              <strong>Warnings to review</strong>
              <ul>
                {analysis.risks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>
            <strong>Assumptions:</strong> {analysis.assumptions.join(" ")}
          </p>
          <p>
            <strong>Limitations:</strong> {analysis.limitations.join(" ")}
          </p>
          <fieldset>
            <legend>Select supported changes to apply</legend>
            {analysis.scenario ? (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={selection.financial}
                  disabled={!analysis.result?.feasible}
                  onChange={(e) =>
                    setSelection({ ...selection, financial: e.target.checked })
                  }
                />
                Apply the displayed financial / guest-count proposal
              </label>
            ) : null}
            <label className="check-label">
              <input
                type="checkbox"
                checked={selection.task}
                onChange={(e) =>
                  setSelection({ ...selection, task: e.target.checked })
                }
              />
              Add priority task: {analysis.proposal.title}
            </label>
            {analysis.edit ? (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={selection.deadline}
                  onChange={(e) =>
                    setSelection({ ...selection, deadline: e.target.checked })
                  }
                />
                Move {analysis.edit.title} to {analysis.edit.dueDate}
              </label>
            ) : null}
          </fieldset>
          <Button
            disabled={props.busy || !Object.values(selection).some(Boolean)}
            onClick={() =>
              props.confirm({
                title: "Apply selected contingency changes?",
                description:
                  "Only the checked changes are committed, in one undoable revision. No supplier is cancelled, no payment is reversed and no message is sent.",
                action: () =>
                  props.update((current) => {
                    if (
                      JSON.stringify(historySnapshot(current)) !==
                      preview!.baseline
                    )
                      throw new Error(
                        "The plan changed. Analyze this contingency again before applying it.",
                      );
                    return applyContingency(current, analysis.input, selection);
                  }, "Apply reviewed contingency playbook"),
              })
            }
          >
            Review selected contingency changes
          </Button>
          <details className="ai-operation">
            <summary>Optional Gemini contingency advice</summary>
            <AIControls state={ai} label="contingency advice" />
            {ai.proposal?.output.kind === "playbook" ? (
              <>
                <IntelligencePreview output={ai.proposal.output} />
                {ai.proposal.output.immediateActions.map((action, index) => (
                  <Button
                    key={index}
                    disabled={props.busy || ai.generating || ai.stale}
                    variant="secondary"
                    onClick={() => {
                      try {
                        ai.assertCurrent(props.workspace);
                        setDraft({
                          ...analysis.proposal,
                          title: action.slice(0, 120),
                          reason: action,
                          assumptions:
                            ai.proposal!.output.kind === "playbook"
                              ? ai.proposal!.output.assumptions
                              : [],
                        });
                      } catch (value) {
                        setError(
                          value instanceof Error
                            ? value.message
                            : "Generate a fresh preview.",
                        );
                      }
                    }}
                  >
                    Review advice task {index + 1}
                  </Button>
                ))}
              </>
            ) : null}
          </details>
          {draft ? (
            <TaskEditor
              key={JSON.stringify(draft)}
              initial={draft}
              props={props}
              close={() => setDraft(undefined)}
            />
          ) : null}
        </div>
      ) : (
        <p className="small-text muted">
          Choose a hypothetical disruption and analyze it. No live weather,
          supplier or price lookup occurs.
        </p>
      )}
    </DecisionPanel>
  );
}

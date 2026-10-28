"use client";
import { applyContingency } from "@/lib/planning/contingency";
import { historySnapshot } from "@/lib/history";
import { DecisionPanel, type DecisionProps } from "@/features/decisions/types";
import { Button } from "@/components/ui/button";
import { useIntelligence } from "@/features/intelligence/use-intelligence";
import { AIControls } from "@/features/intelligence/ai-controls";
import { IntelligencePreview } from "@/features/intelligence/preview";
import { TaskEditor } from "@/features/tasks/task-editor";
import { useContingency } from "./use-contingency";
import { ContingencyInputs, ContingencyFacts } from "./presentation";
export function ContingencyPanel(props: DecisionProps) {
  const { plan } = props.workspace;
  const controls = useContingency(props.workspace);
  const {
    preview,
    selection,
    setSelection,
    draft,
    setDraft,
    error,
    setError,
    analyze,
  } = controls;
  const ai = useIntelligence(props, {
    operation: "contingency-playbook",
    contingency: preview?.analysis.input ?? { kind: "rain" },
  });
  const analysis = preview?.analysis;
  return (
    <DecisionPanel
      id="contingency-planner"
      title="Prepare a thoughtful Plan B"
      description="Seven hypothetical disruptions. Calculate impact locally, then review optional AI alternatives."
    >
      <ContingencyInputs plan={plan} controls={controls} />
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
          <ContingencyFacts plan={plan} analysis={analysis} />
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
                      preview.baseline
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
                        const output = ai.assertCurrent(props.workspace);
                        setDraft({
                          ...analysis.proposal,
                          title: action.slice(0, 120),
                          reason: action,
                          assumptions:
                            output.kind === "playbook"
                              ? output.assumptions
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

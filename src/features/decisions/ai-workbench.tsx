"use client";
import { Button } from "@/components/ui/button";
import { actionRegistry } from "@/lib/ai/operations";
import type { OperationRequest, RefinementAction } from "@/schemas/operations";
import type { DayOfSchedule, ScheduleWindow } from "@/schemas/schedule";
import { DecisionPanel, type DecisionProps } from "./types";
import { OperationProposal } from "./operation-proposal";
import { usePlanOperation } from "./use-plan-operation";
export function AIWorkbench(
  props: DecisionProps & {
    operation: OperationRequest["operation"];
    window?: ScheduleWindow;
    onScheduleAccepted?: (schedule: DayOfSchedule) => void;
  },
) {
  const { operation } = props;
  const {
    workspace,
    action,
    setAction,
    preferences,
    setPreferences,
    proposal,
    setProposal,
    generating,
    status,
    setStatus,
    error,
    handleGenerate,
    cancel,
    accept,
  } = usePlanOperation(props);
  const content = (
    <>
      <p className="small-text privacy-note">
        AI receives event type, date, guest count, currency, category totals,
        the time window when needed, and the preference below. Event titles,
        guest lists, vendor names/contacts, private notes and current invitation
        text are excluded. Avoid names or personal details in preferences.
        Google’s free-tier terms may allow product improvement use.
      </p>
      {operation === "refine-section" ? (
        <label className="standalone-label">
          Refinement action
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value as RefinementAction);
              setProposal(undefined);
            }}
          >
            {Object.entries(actionRegistry)
              .filter(
                ([id]) =>
                  id !== "inclusive-community" ||
                  workspace.plan.event.eventType === "community",
              )
              .map(([id, item]) => (
                <option key={id} value={id}>
                  {item.label}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      <label className="standalone-label">
        Optional AI preferences
        <textarea
          value={preferences}
          maxLength={600}
          rows={2}
          onChange={(event) => setPreferences(event.target.value)}
          placeholder="e.g. Keep activities quiet and low-waste; no personal or contact details"
        />
      </label>
      <div className="action-row">
        <Button
          disabled={generating || props.busy}
          onClick={() => void handleGenerate(false)}
        >
          Generate{" "}
          {operation === "rescue-ideas"
            ? "rescue ideas"
            : operation === "day-of-schedule"
              ? "day-of schedule"
              : "refinement preview"}
        </Button>
        <Button
          variant="secondary"
          disabled={generating || props.busy}
          onClick={() => void handleGenerate(true)}
        >
          Preview sample{" "}
          {operation === "rescue-ideas"
            ? "rescue ideas"
            : operation === "day-of-schedule"
              ? "schedule"
              : "refinement"}
        </Button>
        {generating ? (
          <Button variant="ghost" onClick={cancel}>
            Cancel AI request
          </Button>
        ) : null}
      </div>
      <p role="status" className="small-text">
        {status}
      </p>
      {error ? (
        <p role="alert" className="error-notice">
          {error}
        </p>
      ) : null}
      {proposal ? (
        <OperationProposal
          proposal={proposal}
          busy={props.busy}
          accept={accept}
          reject={() => {
            setProposal(undefined);
            setStatus("Preview rejected. The original content is unchanged.");
          }}
        />
      ) : null}
    </>
  );
  return operation === "refine-section" ? (
    <DecisionPanel
      id="refinement"
      title="Targeted AI refinement"
      description="Improve one section, compare the proposal, then choose whether to apply it."
      printable={false}
    >
      {content}
    </DecisionPanel>
  ) : (
    <details className="ai-operation no-print">
      <summary>
        {operation === "rescue-ideas"
          ? "Optional Budget Rescue AI ideas"
          : "Optional AI schedule proposal"}
      </summary>
      {content}
    </details>
  );
}

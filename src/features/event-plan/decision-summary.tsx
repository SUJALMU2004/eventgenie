import { useMemo } from "react";
import type { Workspace } from "@/lib/planning/workspace";
import { nextActions } from "@/lib/planning/task-workflows";
import { financialPosition } from "@/lib/planning/finance";
import { formatMoney } from "@/features/budget/engine";
export function DecisionSummary({
  workspace,
  loading,
}: {
  workspace: Workspace;
  loading: boolean;
}) {
  const summary = useMemo(
    () => ({
      actions: nextActions(workspace),
      finance: financialPosition(
        workspace.plan,
        workspace.enhancements.quotes,
        workspace.enhancements.expenses,
      ),
    }),
    [workspace],
  );
  return (
    <section
      className="overview-panel decision-summary"
      aria-labelledby="decision-summary-title"
      aria-busy={loading}
    >
      <div>
        <p className="eyebrow">WHAT NEEDS YOUR ATTENTION</p>
        <h2 id="decision-summary-title">A clearer next step.</h2>
        {loading ? (
          <p role="status">Loading saved financial and planning decisions…</p>
        ) : (
          <>
            <p>
              <strong>Budget health:</strong>{" "}
              {summary.finance.shortfallMinor
                ? `Critical shortfall: ${formatMoney(summary.finance.shortfallMinor, workspace.plan.event.currency)}`
                : "Recorded commitments fit within the budget; unbooked costs still need confirmation."}
            </p>
            <p>
              <strong>Readiness:</strong> {summary.actions.readiness.status}
            </p>
            <ul>
              {summary.actions.tasks.slice(0, 3).map((task) => (
                <li key={task.id}>
                  <a href={`#${task.id}`}>{task.title}</a> · {task.dueDate}
                </li>
              ))}
            </ul>
            <a className="text-link" href="#advanced-planning">
              Open next steps, contingency planning and Ask EventGenie →
            </a>
          </>
        )}
      </div>
    </section>
  );
}

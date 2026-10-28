"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { inspectReadiness } from "@/lib/planning/readiness";
import { DecisionPanel, type DecisionProps } from "./types";
export function ReadinessPanel({ workspace, update, busy }: DecisionProps) {
  const { plan, enhancements } = workspace;
  const report = useMemo(
    () =>
      inspectReadiness(
        plan,
        enhancements.quotes,
        enhancements.expenses,
        enhancements.dependencies,
      ),
    [plan, enhancements],
  );
  const [taskId, setTaskId] = useState(plan.tasks[0].id),
    [prerequisite, setPrerequisite] = useState(plan.tasks[1].id);
  return (
    <DecisionPanel
      id="readiness"
      title="Event Readiness"
      description="Transparent rules, not an invented AI percentage."
      open
    >
      <h3>{report.status}</h3>
      <p className="small-text muted">
        {report.remainingDays >= 0
          ? `${report.remainingDays} days remain`
          : "Historical event"}
        . Findings inspect recorded decisions only. A booked vendor is
        user-reported, not independently verified.
      </p>
      {report.findings.length ? (
        <ul className="readiness-findings">
          {report.findings.map((finding, index) => (
            <li
              key={`${finding.ruleId}-${index}`}
              className={`finding-${finding.severity}`}
            >
              <strong>
                {finding.severity === "critical"
                  ? "Critical"
                  : finding.severity === "attention"
                    ? "Review"
                    : "Information"}
              </strong>
              <p>{finding.message}</p>
              <code>{finding.ruleId}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notice">Your event has no critical blockers.</p>
      )}
      <div className="readiness-deadlines">
        <h3>Upcoming deadlines · next 7 days</h3>
        {report.upcoming.length ? (
          <ul>
            {report.upcoming.map((task) => (
              <li key={task.id}>
                {task.title} · {task.dueDate}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small-text">
            No unfinished tasks due in the next seven days.
          </p>
        )}
        <p className="small-text">
          {report.overdue.length} overdue tasks · {report.blocked.length}{" "}
          blocked tasks. Complete a prerequisite yourself; tasks are never
          completed automatically.
        </p>
      </div>
      <details className="no-print">
        <summary>Edit task dependencies</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void update((current) => {
              const existing =
                current.enhancements.dependencies.find(
                  (edge) => edge.taskId === taskId,
                )?.dependsOn ?? [];
              return {
                ...current,
                enhancements: {
                  ...current.enhancements,
                  dependencies: [
                    ...current.enhancements.dependencies.filter(
                      (edge) => edge.taskId !== taskId,
                    ),
                    {
                      taskId,
                      dependsOn: [...new Set([...existing, prerequisite])],
                    },
                  ],
                },
              };
            });
          }}
        >
          <div className="form-grid">
            <label>
              Dependent task
              <select
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
              >
                {plan.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prerequisite task
              <select
                value={prerequisite}
                onChange={(event) => setPrerequisite(event.target.value)}
              >
                {plan.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button disabled={busy} size="small" type="submit">
            Add dependency
          </Button>
        </form>
        {enhancements.dependencies.flatMap((edge) =>
          edge.dependsOn.map((id) => (
            <p key={`${edge.taskId}-${id}`} className="small-text">
              {plan.tasks.find((task) => task.id === edge.taskId)?.title}{" "}
              depends on {plan.tasks.find((task) => task.id === id)?.title}
              <Button
                variant="ghost"
                size="small"
                onClick={() => {
                  void update((current) => ({
                    ...current,
                    enhancements: {
                      ...current.enhancements,
                      dependencies: current.enhancements.dependencies
                        .map((item) =>
                          item.taskId === edge.taskId
                            ? {
                                ...item,
                                dependsOn: item.dependsOn.filter(
                                  (task) => task !== id,
                                ),
                              }
                            : item,
                        )
                        .filter((item) => item.dependsOn.length),
                    },
                  }));
                }}
              >
                Remove dependency
              </Button>
            </p>
          )),
        )}
      </details>
      <details>
        <summary>How these findings are calculated</summary>
        <p>
          High-priority unfinished tasks dated before today are critical.
          Missing supplier decisions become critical within 14 days. Preparation
          under 30 days is flagged. Unfinished prerequisites block dependent
          tasks; overdue prerequisites escalate their finding. Payments and
          commitments are reconciled without double-counting. No readiness score
          or guarantee is inferred.
        </p>
      </details>
    </DecisionPanel>
  );
}

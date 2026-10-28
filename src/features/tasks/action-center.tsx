"use client";
import { useMemo, useState } from "react";
import { DecisionPanel, type DecisionProps } from "@/features/decisions/types";
import { nextActions, type TaskProposal } from "@/lib/planning/task-workflows";
import { taskReferences } from "@/lib/ai/intelligence";
import { today, taskDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { useIntelligence } from "@/features/intelligence/use-intelligence";
import { AIControls } from "@/features/intelligence/ai-controls";
import { IntelligencePreview } from "@/features/intelligence/preview";
import { TaskEditor } from "./task-editor";
export function ActionCenter(props: DecisionProps) {
  const result = useMemo(() => nextActions(props.workspace), [props.workspace]),
    [draft, setDraft] = useState<TaskProposal>(),
    [selected, setSelected] = useState(""),
    [preferences, setPreferences] = useState(""),
    [error, setError] = useState("");
  const ai = useIntelligence(props, {
    operation: "task-suggestions",
    preferences,
  });
  return (
    <DecisionPanel
      id="next-actions"
      title="Your next best steps"
      description="Deterministic priorities first. Optional AI suggestions become tasks only after review."
      open
    >
      <p className="notice">
        {result.readiness.status} · {result.readiness.blocked.length} blocked
        tasks.
      </p>
      {result.tasks.length ? (
        <ol>
          {result.tasks.map((task) => (
            <li key={task.id}>
              <a href={`#${task.id}`}>{task.title}</a> · {task.priority}{" "}
              priority · due {task.dueDate}
            </li>
          ))}
        </ol>
      ) : (
        <p>
          No available incomplete tasks. Review dependencies or enjoy the
          completed checklist.
        </p>
      )}
      <p>
        <a href="#readiness">Review readiness and blockers</a> ·{" "}
        <a href="#budget-rescue">Review budget health</a> ·{" "}
        <a href="#invitation-studio">Review invitations</a>
      </p>
      {result.proposal ? (
        <Button variant="secondary" onClick={() => setDraft(result.proposal)}>
          Review suggested next task
        </Button>
      ) : null}
      <details>
        <summary>Edit an existing task or add a task</summary>
        <label>
          Choose a planning task
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">New task</option>
            {props.workspace.plan.tasks.map((task) => (
              <option key={task.id} value={task.id} disabled={task.completed}>
                {task.title}
                {task.completed ? " (completed)" : ""}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => {
            const task = props.workspace.plan.tasks.find(
              (item) => item.id === selected,
            );
            setDraft(
              task
                ? {
                    taskId: task.id,
                    title: task.title,
                    reason: task.description,
                    category: task.category,
                    dueDate: task.dueDate,
                    priority: task.priority,
                    relatedTaskIds:
                      props.workspace.enhancements.dependencies.find(
                        (edge) => edge.taskId === task.id,
                      )?.dependsOn ?? [],
                    assumptions: [],
                  }
                : {
                    title: "",
                    reason: "",
                    category: props.workspace.plan.tasks[0].category,
                    dueDate: today(),
                    priority: "medium",
                    relatedTaskIds: [],
                    assumptions: [],
                  },
            );
          }}
        >
          Open task editor
        </Button>
      </details>
      <details className="ai-operation">
        <summary>Optional AI task suggestions</summary>
        <label>
          Task preferences (no personal information)
          <textarea
            maxLength={400}
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
          />
        </label>
        <AIControls state={ai} label="task suggestions" />
        {ai.proposal?.output.kind === "tasks" ? (
          <>
            <IntelligencePreview output={ai.proposal.output} />
            {ai.proposal.output.tasks.map((task, index) => (
              <Button
                variant="secondary"
                key={index}
                disabled={props.busy || ai.generating || ai.stale}
                onClick={() => {
                  try {
                    ai.assertCurrent(props.workspace);
                    const refs = taskReferences(props.workspace);
                    setDraft({
                      title: task.title,
                      reason: task.reason,
                      category: task.category,
                      dueDate: taskDate(
                        props.workspace.plan.event.date,
                        task.daysBefore,
                        today(),
                      ),
                      priority: task.priority,
                      relatedTaskIds: task.relatedReferences.map((ref) =>
                        refs.get(ref)!,
                      ),
                      assumptions: task.assumptions,
                    });
                    setError("");
                  } catch (value) {
                    setError(
                      value instanceof Error
                        ? value.message
                        : "Generate a fresh task preview.",
                    );
                  }
                }}
              >
                Review task suggestion {index + 1}
              </Button>
            ))}
          </>
        ) : null}
      </details>
      {error ? (
        <p role="alert" className="error-notice">
          {error}
        </p>
      ) : null}
      {draft ? (
        <TaskEditor
          key={JSON.stringify(draft)}
          initial={draft}
          props={props}
          close={() => setDraft(undefined)}
        />
      ) : null}
    </DecisionPanel>
  );
}

"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { budgetCategories } from "@/data/templates";
import { today } from "@/lib/dates";
import {
  applyTaskProposal,
  taskCategories,
  taskProposalSchema,
  type TaskProposal,
} from "@/lib/planning/task-workflows";
import type { DecisionProps } from "@/features/decisions/types";
import { FormErrors, useFieldErrors } from "@/features/forms/use-field-errors";
export function TaskEditor({
  initial,
  props,
  close,
}: {
  initial: TaskProposal;
  props: DecisionProps;
  close: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const validation = useFieldErrors();
  const [original] = useState(() =>
    JSON.stringify(
      props.workspace.plan.tasks.find((task) => task.id === initial.taskId),
    ),
  );
  function review() {
    try {
      taskProposalSchema.parse(draft);
      applyTaskProposal(props.workspace, draft);
      validation.clear();
      props.confirm({
        title: draft.taskId
          ? "Apply this task edit?"
          : "Add this reviewed task?",
        description: `Before: ${draft.taskId ? props.workspace.plan.tasks.find((task) => task.id === draft.taskId)?.title : "No task added"}. Proposed: ${draft.title}, due ${draft.dueDate}. Existing completed tasks stay unchanged.`,
        action: async () => {
          const ok = await props.update(
            (current) => {
              if (
                draft.taskId &&
                JSON.stringify(
                  current.plan.tasks.find((task) => task.id === draft.taskId),
                ) !== original
              )
                throw new Error(
                  "This task changed while you were editing. Reopen its latest version.",
                );
              return applyTaskProposal(current, draft);
            },
            draft.taskId ? "Edit task and deadline" : "Add approved task",
          );
          if (ok) close();
          return ok;
        },
      });
    } catch (value) {
      validation.report(value);
    }
  }
  return (
    <div className="task-editor notice">
      <h3>Review proposed task</h3>
      <div className="form-grid">
        <label>
          Task title
          <input
            {...validation.field("title")}
            maxLength={120}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          Reason / instructions
          <textarea
            {...validation.field("reason")}
            maxLength={500}
            value={draft.reason}
            onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
          />
        </label>
        <label>
          Task category
          <select
            {...validation.field("category")}
            value={draft.category}
            onChange={(e) =>
              setDraft({
                ...draft,
                category: e.target.value as TaskProposal["category"],
              })
            }
          >
            {taskCategories(props.workspace).map((id) => (
              <option key={id} value={id}>
                {budgetCategories[props.workspace.plan.event.eventType].find(
                  (item) => item.id === id,
                )?.label ?? id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Proposed deadline
          <input
            {...validation.field("dueDate")}
            type="date"
            min={today()}
            max={props.workspace.plan.event.date}
            value={draft.dueDate}
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
          />
        </label>
        <label>
          Task priority
          <select
            {...validation.field("priority")}
            value={draft.priority}
            onChange={(e) =>
              setDraft({
                ...draft,
                priority: e.target.value as TaskProposal["priority"],
              })
            }
          >
            {["high", "medium", "low"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Prerequisites (up to three)
          <select
            {...validation.field("relatedTaskIds")}
            multiple
            value={draft.relatedTaskIds}
            onChange={(e) =>
              setDraft({
                ...draft,
                relatedTaskIds: [...e.target.selectedOptions].map(
                  (item) => item.value,
                ),
              })
            }
          >
            {props.workspace.plan.tasks
              .filter((task) => task.id !== draft.taskId)
              .map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="small-text">
        Assumptions:{" "}
        {draft.assumptions.join(" ") ||
          "The organiser must confirm feasibility."}
      </p>
      <FormErrors
        errors={validation.errors}
        errorId={validation.errorId}
        summaryRef={validation.summaryRef}
      />
      <div className="button-row">
        <Button disabled={props.busy} onClick={review}>
          Review task change
        </Button>
        <Button variant="ghost" onClick={close}>
          Discard task draft
        </Button>
      </div>
    </div>
  );
}

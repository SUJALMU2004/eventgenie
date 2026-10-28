"use client";
import { useState } from "react";
import { formatDate, today } from "@/lib/dates";
import type { EventPlan } from "@/schemas/plan";
import { Button } from "@/components/ui/button";

export function TimelineView({
  plan,
  updating,
  toggle,
}: {
  plan: EventPlan;
  updating: boolean;
  toggle: (id: string, checked: boolean) => void;
}) {
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");
  const completed = plan.tasks.filter((task) => task.completed).length;
  const tasks = plan.tasks
    .filter((task) =>
      filter === "completed"
        ? task.completed
        : filter === "upcoming"
          ? !task.completed
          : true,
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ONE LITTLE STEP AT A TIME</p>
          <h2 id="timeline-title">The road to your celebration.</h2>
        </div>
        <span className="badge">
          {completed} of {plan.tasks.length} done
        </span>
      </div>
      <progress
        aria-label="Planning task completion"
        max={plan.tasks.length}
        value={completed}
      />
      <div
        className="filter-buttons"
        role="group"
        aria-label="Filter planning tasks"
      >
        {(["all", "upcoming", "completed"] as const).map((value) => (
          <Button
            key={value}
            size="small"
            variant="ghost"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value === "all"
              ? "All tasks"
              : value === "upcoming"
                ? "To do"
                : "Completed"}
          </Button>
        ))}
      </div>
      {tasks.length ? (
        <ol className="task-list">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={task.completed ? "task-completed" : ""}
            >
              <input
                type="checkbox"
                id={task.id}
                checked={task.completed}
                onChange={(e) => toggle(task.id, e.target.checked)}
                disabled={updating}
              />
              <div className="task-body">
                <label htmlFor={task.id}>{task.title}</label>
                <p>{task.description}</p>
                <div className="task-meta">
                  <time dateTime={task.dueDate}>
                    {formatDate(task.dueDate)}
                  </time>
                  <span className={`priority priority-${task.priority}`}>
                    {task.priority} priority
                  </span>
                  {!task.completed && task.dueDate < today() ? (
                    <span>Overdue</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="notice">
          {filter === "completed"
            ? "Your first little win is waiting. Check off a completed task above."
            : "Everything is checked off. Make room for the celebration!"}
        </p>
      )}
    </section>
  );
}

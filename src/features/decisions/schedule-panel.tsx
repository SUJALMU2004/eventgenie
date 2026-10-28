"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { vendorCategories } from "@/data/vendor-categories";
import {
  exampleSchedule,
  formatTime,
  parseTime,
  reorderSchedule,
  validateSchedule,
} from "@/lib/planning/schedule";
import type { DayOfSchedule, ScheduleWindow } from "@/schemas/schedule";
import { DecisionPanel, type DecisionProps } from "./types";
import { AIWorkbench } from "./ai-workbench";
export function SchedulePanel(props: DecisionProps) {
  const { workspace, update, confirm, busy } = props,
    { plan, enhancements } = workspace;
  const [start, setStart] = useState(() =>
      formatTime(enhancements.schedule?.startMinute ?? 540),
    ),
    [end, setEnd] = useState(() =>
      formatTime(enhancements.schedule?.endMinute ?? 1020),
    ),
    [timeZone, setTimeZone] = useState<ScheduleWindow["timeZone"]>(
      enhancements.schedule?.timeZone ?? "Asia/Kolkata",
    );
  const [draft, setDraft] = useState<DayOfSchedule | undefined>(
      enhancements.schedule,
    ),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const window: ScheduleWindow = {
    startMinute: parseTime(start) ?? -1,
    endMinute: parseTime(end) ?? -1,
    timeZone,
  };
  function edit(
    index: number,
    values: Partial<DayOfSchedule["activities"][number]>,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            activities: current.activities.map((item, itemIndex) =>
              index === itemIndex ? { ...item, ...values } : item,
            ),
          }
        : current,
    );
    setDirty(true);
  }
  function sample() {
    try {
      const next = exampleSchedule(plan.event.eventType, window);
      const load = async () => {
        setDraft(next);
        setDirty(true);
        setError("");
        return true;
      };
      if (dirty || enhancements.schedule)
        confirm({
          title: "Replace the schedule draft with a sample?",
          description:
            "This changes the draft only. Your saved schedule stays intact until you explicitly save the draft.",
          action: load,
        });
      else void load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Check the event window",
      );
    }
  }
  async function save() {
    if (!draft) return;
    try {
      const value = validateSchedule(plan, {
        ...draft,
        ...window,
        source: draft.source === "demo" ? "demo" : "user",
        updatedAt: new Date().toISOString(),
      });
      const saved = await update((current) => ({
        ...current,
        enhancements: {
          ...current.enhancements,
          schedule: validateSchedule(current.plan, value),
          cache: [],
        },
      }));
      if (saved) {
        setDraft(value);
        setDirty(false);
        setError("");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Check schedule conflicts",
      );
    }
  }
  return (
    <DecisionPanel
      id="day-of"
      title="Day-of Schedule"
      description="An event-day running order, separate from your preparation checklist."
    >
      <p className="small-text muted">
        Times use the selected local context on {plan.event.date}. Same-day
        events only; overnight windows are not supported. Vendor arrival and
        travel times are estimates for you to confirm.
      </p>
      <div className="form-grid no-print">
        <label>
          Event start time
          <input
            type="time"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          Event end time
          <input
            type="time"
            value={end}
            onChange={(event) => {
              setEnd(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          Event local time zone
          <select
            value={timeZone}
            onChange={(event) => {
              setTimeZone(event.target.value as ScheduleWindow["timeZone"]);
              setDirty(true);
            }}
          >
            <option>Asia/Kolkata</option>
            <option>UTC</option>
            <option>Europe/London</option>
            <option>America/New_York</option>
          </select>
        </label>
      </div>
      <div className="action-row no-print">
        <Button variant="secondary" onClick={sample}>
          Load sample day-of schedule
        </Button>
        {draft ? (
          <Button
            disabled={busy}
            onClick={() =>
              confirm({
                title: "Save this event-day schedule?",
                description:
                  "This replaces the saved schedule with the edited draft. Preparation tasks and vendor commitments are unchanged. Conflicting times will be rejected.",
                action: saveAndConfirm,
              })
            }
          >
            Save day-of schedule
          </Button>
        ) : null}
        {draft ? (
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(enhancements.schedule);
              setDirty(false);
              setError("");
              if (enhancements.schedule) {
                setStart(formatTime(enhancements.schedule.startMinute));
                setEnd(formatTime(enhancements.schedule.endMinute));
                setTimeZone(enhancements.schedule.timeZone);
              }
            }}
          >
            Reset schedule draft
          </Button>
        ) : null}
      </div>
      {dirty ? (
        <p className="small-text no-print">
          Unsaved schedule draft · changing controls does not alter the saved
          running order.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="error-notice">
          {error}
        </p>
      ) : null}
      {draft ? (
        <div className="schedule-editor no-print">
          <p className="small-text">
            {draft.activities.length} activities ·{" "}
            {draft.activities.reduce(
              (sum, item) => sum + item.durationMinutes,
              0,
            )}{" "}
            scheduled minutes · positive durations, no overlaps and
            setup-to-cleanup order required.
          </p>
          {draft.activities.map((item, index) => (
            <fieldset key={item.id} className="schedule-block">
              <legend>
                Activity {index + 1} · {item.role}
              </legend>
              <div className="form-grid">
                <label>
                  Activity {index + 1} title
                  <input
                    maxLength={120}
                    value={item.title}
                    onChange={(event) =>
                      edit(index, { title: event.target.value })
                    }
                  />
                </label>
                <label>
                  Activity {index + 1} start
                  <input
                    type="time"
                    value={formatTime(item.startMinute)}
                    onChange={(event) =>
                      edit(index, {
                        startMinute: parseTime(event.target.value) ?? -1,
                      })
                    }
                  />
                </label>
                <label>
                  Activity {index + 1} duration (minutes)
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={item.durationMinutes}
                    onChange={(event) =>
                      edit(index, {
                        durationMinutes: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Activity {index + 1} vendor category
                  <select
                    value={item.vendorCategory ?? ""}
                    onChange={(event) =>
                      edit(index, {
                        vendorCategory:
                          vendorCategories(plan.event.eventType).find(
                            (vendor) => vendor.id === event.target.value,
                          )?.id ?? null,
                      })
                    }
                  >
                    <option value="">No vendor link</option>
                    {vendorCategories(plan.event.eventType).map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-wide">
                  Activity {index + 1} linked preparation task
                  <select
                    value={item.taskId ?? ""}
                    onChange={(event) =>
                      edit(index, { taskId: event.target.value || null })
                    }
                  >
                    <option value="">No task link</option>
                    {plan.tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="action-row">
                <Button
                  variant="ghost"
                  size="small"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  Move activity {index + 1} up
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={index === draft.activities.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Move activity {index + 1} down
                </Button>
              </div>
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="notice">
          No event-day schedule yet. Load an offline sample or request an AI
          proposal.
        </p>
      )}
      {enhancements.schedule ? (
        <div className="schedule-summary">
          <h3>
            Saved running order ·{" "}
            {enhancements.schedule.source === "demo"
              ? "Sample"
              : enhancements.schedule.source === "ai"
                ? "AI proposal accepted"
                : "User edited"}
          </h3>
          <p className="small-text">
            {enhancements.schedule.timeZone} · event date {plan.event.date}
          </p>
          <div className="table-scroll">
            <table className="decision-table">
              <caption>Saved event-day activities</caption>
              <thead>
                <tr>
                  <th scope="col">Local start</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Duration</th>
                </tr>
              </thead>
              <tbody>
                {enhancements.schedule.activities.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTime(item.startMinute)}</td>
                    <th scope="row">{item.title}</th>
                    <td>{item.durationMinutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <AIWorkbench
        {...props}
        operation="day-of-schedule"
        window={window}
        onScheduleAccepted={(schedule) => {
          setDraft(schedule);
          setDirty(false);
          setStart(formatTime(schedule.startMinute));
          setEnd(formatTime(schedule.endMinute));
          setTimeZone(schedule.timeZone);
        }}
      />
    </DecisionPanel>
  );
  async function saveAndConfirm() {
    await save();
    return false;
  }
  function move(index: number, direction: number) {
    if (!draft) return;
    const activities = [...draft.activities];
    [activities[index], activities[index + direction]] = [
      activities[index + direction],
      activities[index],
    ];
    setDraft(
      reorderSchedule(
        { ...draft, startMinute: window.startMinute },
        activities,
      ),
    );
    setDirty(true);
  }
}

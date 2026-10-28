"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  exampleSchedule,
  formatTime,
  parseTime,
  reorderSchedule,
  validateSchedule,
} from "@/lib/planning/schedule";
import type { DayOfSchedule, ScheduleWindow } from "@/schemas/schedule";
import { DecisionPanel, type DecisionProps } from "./types";
import { FormErrors, useFieldErrors } from "@/features/forms/use-field-errors";
import { ScheduleActivityEditor } from "./schedule-activity-editor";
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
    [dirty, setDirty] = useState(false);
  const validation = useFieldErrors();
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
        validation.clear();
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
      validation.report(error);
    }
  }
  async function save() {
    if (!draft) return false;
    try {
      const value = validatedDraft();
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
        validation.clear();
      }
      return saved;
    } catch (error) {
      validation.report(error);
      return false;
    }
  }
  function validatedDraft() {
    if (!draft) throw new Error("Load a schedule draft first.");
    return validateSchedule(plan, {
      ...draft,
      ...window,
      source: draft.source === "demo" ? "demo" : "user",
      updatedAt: new Date().toISOString(),
    });
  }
  function reviewSave() {
    try {
      validatedDraft();
      validation.clear();
      confirm({
        title: "Save this event-day schedule?",
        description:
          "This replaces the saved schedule with the edited draft. Preparation tasks and vendor commitments are unchanged. Conflicting times will be rejected.",
        action: save,
      });
    } catch (error) {
      validation.report(error);
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
            {...validation.field("startMinute")}
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
            {...validation.field("endMinute")}
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
            {...validation.field("timeZone")}
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
          <Button disabled={busy} onClick={reviewSave}>
            Save day-of schedule
          </Button>
        ) : null}
        {draft ? (
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(enhancements.schedule);
              setDirty(false);
              validation.clear();
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
      <FormErrors
        errors={validation.errors}
        errorId={validation.errorId}
        summaryRef={validation.summaryRef}
      />
      {draft ? (
        <ScheduleActivityEditor
          draft={draft}
          plan={plan}
          edit={edit}
          move={move}
          validation={validation}
        />
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
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Scrollable saved event-day activities"
          >
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

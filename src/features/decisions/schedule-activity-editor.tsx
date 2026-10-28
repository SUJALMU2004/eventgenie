import { Button } from "@/components/ui/button";
import { vendorCategories } from "@/data/vendor-categories";
import { formatTime, parseTime } from "@/lib/planning/schedule";
import type { DayOfSchedule } from "@/schemas/schedule";
import type { EventPlan } from "@/schemas/plan";
import type { useFieldErrors } from "@/features/forms/use-field-errors";
export function ScheduleActivityEditor({
  draft,
  plan,
  edit,
  move,
  validation,
}: {
  draft: DayOfSchedule;
  plan: EventPlan;
  edit: (
    index: number,
    values: Partial<DayOfSchedule["activities"][number]>,
  ) => void;
  move: (index: number, direction: number) => void;
  validation: ReturnType<typeof useFieldErrors>;
}) {
  return (
    <div className="schedule-editor no-print">
      <p className="small-text">
        {draft.activities.length} activities ·{" "}
        {draft.activities.reduce((sum, item) => sum + item.durationMinutes, 0)}{" "}
        scheduled minutes · positive durations, no overlaps and setup-to-cleanup
        order required.
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
                {...validation.field(`activities.${index}.title`)}
                maxLength={120}
                value={item.title}
                onChange={(event) => edit(index, { title: event.target.value })}
              />
            </label>
            <label>
              Activity {index + 1} start
              <input
                type="time"
                {...validation.field(`activities.${index}.startMinute`)}
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
                {...validation.field(`activities.${index}.durationMinutes`)}
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
                {...validation.field(`activities.${index}.vendorCategory`)}
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
                {...validation.field(`activities.${index}.taskId`)}
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
  );
}

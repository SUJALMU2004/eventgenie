import type { EventPlan } from "@/schemas/plan";
import {
  activityRoles,
  scheduleSchema,
  scheduleWindowSchema,
  type DayOfActivity,
  type DayOfSchedule,
  type ScheduleWindow,
} from "@/schemas/schedule";
import type { EventType } from "@/schemas/event";
import { vendorCategories } from "@/data/vendor-categories";
export function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
export function formatTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
const definitions: Record<
  EventType,
  readonly [(typeof activityRoles)[number], string][]
> = {
  wedding: [
    ["setup", "Prepare the venue"],
    ["briefing", "Coordinate supplier arrivals"],
    ["arrival", "Welcome guests"],
    ["ceremony", "Wedding ceremony"],
    ["photos", "Family photographs"],
    ["dining", "Share the wedding meal"],
    ["closing", "Closing wishes"],
    ["cleanup", "Pack down and check the venue"],
  ],
  birthday: [
    ["setup", "Set up decorations"],
    ["briefing", "Check catering arrangements"],
    ["arrival", "Welcome birthday guests"],
    ["games", "Birthday games"],
    ["cake", "Cake and birthday wishes"],
    ["dining", "Serve food"],
    ["closing", "Thank guests"],
    ["cleanup", "Clean up together"],
  ],
  community: [
    ["setup", "Prepare accessible registration"],
    ["briefing", "Brief volunteers"],
    ["arrival", "Welcome and register guests"],
    ["opening", "Open the community gathering"],
    ["activities", "Shared community activities"],
    ["break", "Refreshment break"],
    ["closing", "Closing acknowledgements"],
    ["cleanup", "Volunteer cleanup"],
  ],
};
export function exampleSchedule(
  type: EventType,
  raw: ScheduleWindow,
  clock: () => Date = () => new Date(),
): DayOfSchedule {
  const window = scheduleWindowSchema.parse(raw),
    blocks = definitions[type];
  const span = window.endMinute - window.startMinute;
  if (span < blocks.length)
    throw new Error("Allow at least eight minutes for the sample schedule");
  let offset = window.startMinute;
  const activities = blocks.map(([role, title], index) => {
    const durationMinutes =
      Math.floor(span / blocks.length) + (index < span % blocks.length ? 1 : 0);
    const activity = {
      id: crypto.randomUUID(),
      title,
      role,
      startMinute: offset,
      durationMinutes,
      vendorCategory: null,
      taskId: null,
    };
    offset += durationMinutes;
    return activity;
  });
  return {
    ...window,
    activities,
    source: "demo",
    updatedAt: clock().toISOString(),
  };
}
export function validateSchedule(
  plan: {
    event: Pick<EventPlan["event"], "eventType">;
    tasks: readonly { id: string }[];
  },
  raw: DayOfSchedule,
): DayOfSchedule {
  const schedule = scheduleSchema.parse(raw);
  scheduleWindowSchema.parse({
    startMinute: schedule.startMinute,
    endMinute: schedule.endMinute,
    timeZone: schedule.timeZone,
  });
  const sorted = [...schedule.activities].sort(
    (a, b) => a.startMinute - b.startMinute,
  );
  if (new Set(sorted.map((item) => item.id)).size !== sorted.length)
    throw new Error("Schedule identifiers must be unique");
  const vendorIds = new Set(
    vendorCategories(plan.event.eventType).map((item) => item.id),
  );
  for (const [index, item] of sorted.entries()) {
    if (
      item.startMinute < schedule.startMinute ||
      item.startMinute + item.durationMinutes > schedule.endMinute
    )
      throw new Error(`${item.title} falls outside the declared event window`);
    if (
      index &&
      sorted[index - 1].startMinute + sorted[index - 1].durationMinutes >
        item.startMinute
    )
      throw new Error(`${sorted[index - 1].title} overlaps with ${item.title}`);
    if (item.taskId && !plan.tasks.some((task) => task.id === item.taskId))
      throw new Error("Schedule links to a missing preparation task");
    if (item.vendorCategory && !vendorIds.has(item.vendorCategory))
      throw new Error("Schedule links to an unsupported supplier category");
  }
  const required =
    plan.event.eventType === "wedding"
      ? ["setup", "arrival", "ceremony", "cleanup"]
      : plan.event.eventType === "birthday"
        ? ["setup", "arrival", "cake", "cleanup"]
        : ["setup", "briefing", "arrival", "opening", "closing", "cleanup"];
  let previousEnd = schedule.startMinute;
  for (const role of required) {
    const block = sorted.find((item) => item.role === role);
    if (!block)
      throw new Error(`Include the ${role} activity required for this event`);
    if (block.startMinute < previousEnd)
      throw new Error(`The ${role} activity is out of sequence`);
    previousEnd = block.startMinute + block.durationMinutes;
  }
  if (sorted[0].role !== "setup" || sorted.at(-1)?.role !== "cleanup")
    throw new Error("Begin with setup and finish with cleanup");
  return { ...schedule, activities: sorted };
}
export function reorderSchedule(
  schedule: DayOfSchedule,
  activities: DayOfActivity[],
): DayOfSchedule {
  let offset = schedule.startMinute;
  return {
    ...schedule,
    activities: activities.map((item) => {
      const next = { ...item, startMinute: offset };
      offset += item.durationMinutes;
      return next;
    }),
  };
}

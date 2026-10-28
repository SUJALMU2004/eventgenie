import { z } from "zod";
import { prioritySchema } from "./event";
import { localText } from "./finance";
export const activityRoles = [
  "setup",
  "briefing",
  "arrival",
  "ceremony",
  "photos",
  "games",
  "cake",
  "dining",
  "opening",
  "activities",
  "break",
  "closing",
  "cleanup",
] as const;
export const scheduleWindowSchema = z
  .object({
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    timeZone: z.enum([
      "Asia/Kolkata",
      "UTC",
      "Europe/London",
      "America/New_York",
    ]),
  })
  .strict()
  .refine(
    (value) => value.endMinute > value.startMinute,
    "Use a same-day window with the end after the start; overnight events are not supported.",
  );
export const activityContentSchema = z
  .object({
    title: localText(120).min(1),
    role: z.enum(activityRoles),
    startMinute: z.number().int().min(0).max(1439),
    durationMinutes: z.number().int().min(1).max(1440),
    vendorCategory: prioritySchema.nullable(),
    taskId: z.string().max(100).nullable(),
  })
  .strict();
export const activitySchema = activityContentSchema.extend({
  id: z.string().uuid(),
});
export const scheduleSchema = z
  .object({
    ...scheduleWindowSchema.shape,
    activities: z.array(activitySchema).min(6).max(12),
    source: z.enum(["user", "ai", "demo"]),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type ScheduleWindow = z.infer<typeof scheduleWindowSchema>;
export type DayOfSchedule = z.infer<typeof scheduleSchema>;
export type DayOfActivity = z.infer<typeof activitySchema>;
export const dependencySchema = z
  .object({
    taskId: z.string().min(1).max(100),
    dependsOn: z
      .array(z.string().min(1).max(100))
      .max(20)
      .refine((items) => new Set(items).size === items.length),
  })
  .strict();
export type TaskDependency = z.infer<typeof dependencySchema>;

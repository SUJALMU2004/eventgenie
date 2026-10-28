import { z } from "zod";
import { isDateOnly, today } from "@/lib/dates";

export const eventTypes = ["wedding", "birthday", "community"] as const;
export const currencies = ["INR", "USD", "EUR", "GBP", "JPY"] as const;
export const eventTypeSchema = z.enum(eventTypes);
const text = (length: number) =>
  z
    .string()
    .trim()
    .max(length)
    .refine(
      (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value),
      "Remove control characters",
    );
export const dateSchema = z.string().refine(isDateOnly, "Enter a valid date");
export const prioritySchema = z.enum([
  "venue",
  "catering",
  "decor",
  "photography",
  "entertainment",
  "clothing",
  "cake",
  "av",
  "logistics",
  "activities",
  "safety",
]);

/** Structural validation is timeless: saved plans remain readable after the event. */
export const eventSchema = z
  .object({
    eventType: eventTypeSchema,
    title: text(100).min(2, "Enter an event title (at least 2 characters)"),
    subtype: text(80).default(""),
    date: dateSchema,
    city: text(100).min(2, "Enter a city or location"),
    guests: z
      .number()
      .int()
      .min(1, "Invite at least one guest")
      .max(10000, "Use 10,000 guests or fewer"),
    budgetMinor: z
      .number()
      .int()
      .min(1, "Enter a positive budget")
      .max(100000000000, "Budget is too large"),
    currency: z.enum(currencies).default("INR"),
    style: text(200).default(""),
    setting: z.enum(["indoor", "outdoor", "flexible"]).default("flexible"),
    food: text(200).default(""),
    culture: text(300).default(""),
    priorities: z
      .array(prioritySchema)
      .max(3)
      .refine(
        (items) => new Set(items).size === items.length,
        "Choose each priority once",
      )
      .default([]),
    requirements: text(500).default(""),
    notes: text(1000).default(""),
  })
  .strict();

export const generationInputSchema = (clock: () => Date = () => new Date()) =>
  eventSchema.refine((event) => event.date > today(clock), {
    path: ["date"],
    message: "Choose a future event date",
  });
export type EventInput = z.infer<typeof eventSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type Currency = (typeof currencies)[number];
export type Priority = z.infer<typeof prioritySchema>;

export function emptyEvent(eventType: EventType = "wedding"): EventInput {
  return {
    eventType,
    title: "",
    subtype: "",
    date: "",
    city: "",
    guests: 100,
    budgetMinor: 10000000,
    currency: "INR",
    style: "",
    setting: "flexible",
    food: "",
    culture: "",
    priorities: [],
    requirements: "",
    notes: "",
  };
}

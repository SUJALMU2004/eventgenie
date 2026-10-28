import { z } from "zod";
import {
  currencies,
  dateSchema,
  eventTypeSchema,
  prioritySchema,
} from "./event";
import { ideaSchema, apiErrorSchema } from "./plan";
import { localText, minorSchema } from "./finance";
import {
  activityContentSchema,
  activitySchema,
  scheduleWindowSchema,
} from "./schedule";
export const refinementActions = [
  "saving-ideas",
  "simpler-decor",
  "formal-invitation",
  "playful-invitation",
  "children-schedule",
  "inclusive-community",
  "rainy-day",
] as const;
export const refinementActionSchema = z.enum(refinementActions);
export type RefinementAction = z.infer<typeof refinementActionSchema>;
export const rescueContentSchema = z
  .object({
    title: localText(120).min(1),
    explanation: localText(500).min(1),
    affectedCategories: z.array(prioritySchema).min(1).max(4),
    estimatedImpactType: z.enum([
      "reduce-optional-spending",
      "simplify-logistics",
      "protect-priorities",
    ]),
    feasibilityConditions: z.array(localText(250)).min(1).max(4),
    tradeoffs: z.array(localText(250)).min(1).max(4),
    confidenceLimitations: localText(400).min(1),
  })
  .strict();
export const rescueRecommendationSchema = rescueContentSchema.extend({
  recommendationId: z.string().uuid(),
});
export const operationContextSchema = z
  .object({
    eventType: eventTypeSchema,
    eventDate: dateSchema,
    guests: z.number().int().min(1).max(10000),
    currency: z.enum(currencies),
    budgetMinor: minorSchema.refine((value) => value > 0),
    categories: z.array(prioritySchema).min(1).max(11),
    finances: z
      .array(
        z
          .object({
            category: prioritySchema,
            allocatedMinor: minorSchema,
            protectedMinor: minorSchema,
          })
          .strict(),
      )
      .max(11),
  })
  .strict();
// No event title, guest/contact fields, vendor names, notes, invitation text or backups cross this boundary.
export const operationRequestSchema = z
  .object({
    operation: z.enum(["rescue-ideas", "day-of-schedule", "refine-section"]),
    action: refinementActionSchema.optional(),
    context: operationContextSchema,
    preferences: localText(600).refine(
      (value) =>
        !/[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d ()-]{7,}\d/i.test(value),
      "Remove contact details before using AI",
    ),
    window: scheduleWindowSchema.optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.operation === "refine-section" && !input.action)
      ctx.addIssue({
        code: "custom",
        path: ["action"],
        message: "Select a supported refinement action",
      });
    if (input.operation !== "refine-section" && input.action)
      ctx.addIssue({
        code: "custom",
        message: "Refinement actions are only valid for section refinement",
      });
    if (
      (input.operation === "day-of-schedule" ||
        input.action === "children-schedule") &&
      !input.window
    )
      ctx.addIssue({
        code: "custom",
        path: ["window"],
        message: "Set the event-day start and end times",
      });
    if (
      input.action === "inclusive-community" &&
      input.context.eventType !== "community"
    )
      ctx.addIssue({
        code: "custom",
        message: "Inclusive-community refinement is for community events",
      });
  });
export type OperationRequest = z.infer<typeof operationRequestSchema>;
export const rescueOutputSchema = z
  .object({
    kind: z.literal("rescue"),
    recommendations: z.array(rescueContentSchema).min(2).max(5),
  })
  .strict();
export const scheduleOutputSchema = z
  .object({
    kind: z.literal("schedule"),
    activities: z.array(activityContentSchema).min(6).max(12),
  })
  .strict();
export const ideasOutputSchema = z
  .object({
    kind: z.literal("ideas"),
    ideas: z.array(ideaSchema.strict()).min(4).max(6),
  })
  .strict();
export const invitationsOutputSchema = z
  .object({
    kind: z.literal("invitations"),
    invitations: z.array(localText(800).min(1)).min(1).max(2),
  })
  .strict();
export const operationOutputSchema = z.discriminatedUnion("kind", [
  rescueOutputSchema.extend({
    recommendations: z.array(rescueRecommendationSchema).min(2).max(5),
  }),
  scheduleOutputSchema.extend({
    activities: z.array(activitySchema).min(6).max(12),
  }),
  ideasOutputSchema,
  invitationsOutputSchema,
]);
export const rawOperationOutputSchema = z.discriminatedUnion("kind", [
  rescueOutputSchema,
  scheduleOutputSchema,
  ideasOutputSchema,
  invitationsOutputSchema,
]);
export type OperationOutput = z.infer<typeof operationOutputSchema>;
export const operationStreamSchema = z.discriminatedUnion("type", [
  z
    .object({
      version: z.literal(2),
      type: z.literal("preview"),
      data: z
        .object({
          itemsReceived: z.number().int().min(1).max(12),
          kind: z.enum(["rescue", "schedule", "ideas", "invitations"]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      type: z.literal("complete"),
      data: operationOutputSchema,
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      type: z.literal("error"),
      error: apiErrorSchema,
    })
    .strict(),
]);

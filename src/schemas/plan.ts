import { z } from "zod";
import { dateSchema, eventSchema, prioritySchema } from "./event";

const short = z.string().trim().min(1).max(500);
export const importanceSchema = z.enum(["high", "medium", "low"]);
export const overviewSchema = z.object({
  description: short,
  approach: short,
  priorities: z.array(short).min(1).max(5),
  considerations: z.array(short).max(5),
});
export const aiTaskSchema = z.object({
  title: z.string().min(1).max(120),
  description: short,
  daysBefore: z.number().int().min(0).max(730),
  priority: importanceSchema,
  category: prioritySchema,
});
export const aiVendorSchema = z.object({
  category: z.string().min(1).max(100),
  purpose: short,
  priority: importanceSchema,
  daysBefore: z.number().int().min(0).max(730),
  questions: z.array(short).min(1).max(4),
});
export const ideaSchema = z.object({
  category: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  description: short,
});
export const recommendationsSchema = z.object({
  overview: overviewSchema,
  budgetNotes: z
    .array(z.object({ category: prioritySchema, explanation: short }))
    .min(1)
    .max(11),
  tasks: z.array(aiTaskSchema).min(12).max(20),
  vendors: z.array(aiVendorSchema).min(3).max(10),
  ideas: z.array(ideaSchema).min(4).max(6),
  invitations: z.array(z.string().min(1).max(800)).min(1).max(2),
  warnings: z.array(short).max(8),
});
export type Recommendations = z.infer<typeof recommendationsSchema>;

export const planSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    fingerprint: z.string().min(1),
    source: z.enum(["ai", "demo"]),
    createdAt: z.string().datetime(),
    event: eventSchema,
    overview: overviewSchema,
    budget: z
      .array(
        z.object({
          id: z.string(),
          label: short,
          amountMinor: z.number().int().nonnegative(),
        }),
      )
      .min(1),
    budgetNotes: recommendationsSchema.shape.budgetNotes,
    tasks: z
      .array(
        aiTaskSchema.omit({ daysBefore: true }).extend({
          id: z.string(),
          dueDate: dateSchema,
          completed: z.boolean(),
        }),
      )
      .min(12)
      .max(60),
    vendors: z
      .array(
        aiVendorSchema.omit({ daysBefore: true }).extend({
          id: z.string(),
          bookingDate: dateSchema,
          completed: z.boolean(),
        }),
      )
      .min(3)
      .max(10),
    ideas: recommendationsSchema.shape.ideas,
    invitations: z.array(z.string().min(1).max(2000)).min(1).max(2),
    warnings: z.array(short).max(12),
  })
  .superRefine((plan, context) => {
    if (
      plan.budget.reduce((sum, category) => sum + category.amountMinor, 0) !==
      plan.event.budgetMinor
    )
      context.addIssue({
        code: "custom",
        path: ["budget"],
        message: "Budget does not balance",
      });
    for (const field of ["tasks", "vendors", "budget"] as const)
      if (
        new Set(plan[field].map((item) => item.id)).size !== plan[field].length
      )
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Duplicate identifiers",
        });
  });
export type EventPlan = z.infer<typeof planSchema>;
export const previewSchema = z.object({
  overview: overviewSchema.optional(),
  tasks: z.array(aiTaskSchema).max(20).optional(),
  vendors: z.array(aiVendorSchema).max(10).optional(),
  ideas: z.array(ideaSchema).max(6).optional(),
});
export type PlanPreview = z.infer<typeof previewSchema>;
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  retryAfter: z.number().nonnegative().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
export const streamMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("preview"), data: previewSchema }),
  z.object({ type: z.literal("complete"), data: planSchema }),
  z.object({ type: z.literal("error"), error: apiErrorSchema }),
]);
export type StreamMessage = z.infer<typeof streamMessageSchema>;

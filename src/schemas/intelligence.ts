import { z } from "zod";
import {
  dateSchema,
  eventTypeSchema,
  prioritySchema,
  currencies,
} from "./event";
import { localText, minorSchema } from "./finance";
import { importanceSchema, apiErrorSchema } from "./plan";
export const contingencyKinds = [
  "rain",
  "vendor-cancellation",
  "budget-reduction",
  "cost-increase",
  "guest-increase",
  "attendance-drop",
  "task-delay",
] as const;
export const contingencyInputSchema = z
  .object({
    kind: z.enum(contingencyKinds),
    amountMinor: minorSchema.optional(),
    guests: z.number().int().min(1).max(10000).optional(),
    category: prioritySchema.optional(),
    taskId: localText(180).optional(),
    newDueDate: dateSchema.optional(),
  })
  .strict();
export type ContingencyInput = z.infer<typeof contingencyInputSchema>;
export const invitationToneSchema = z.enum([
  "formal",
  "friendly",
  "elegant",
  "minimal",
  "playful",
]);
export const invitationFactsSchema = z
  .object({ time: localText(80), venue: localText(200), rsvp: localText(200) })
  .strict();
export const privateBoundedText = (limit: number) =>
  localText(limit).refine(
    (value) =>
      !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\s().-]*){8,}/.test(value),
    "Keep contact details out of AI questions and preferences",
  );
export const planReferenceSchema = z
  .string()
  .regex(
    /^(?:overview|budget|vendors|timeline|invitations|schedule|task-[1-9]\d?)$/,
  );
const taskContextSchema = z
  .object({
    ref: planReferenceSchema,
    category: prioritySchema,
    priority: importanceSchema,
    dueDate: dateSchema,
    completed: z.boolean(),
    blocked: z.boolean(),
  })
  .strict();
export const intelligenceContextSchema = z
  .object({
    eventType: eventTypeSchema,
    eventDate: dateSchema.optional(),
    today: dateSchema.optional(),
    guests: z.number().int().min(1).max(10000).optional(),
    currency: z.enum(currencies).optional(),
    references: z.array(planReferenceSchema).max(70),
    tasks: z.array(taskContextSchema).max(60),
    finances: z
      .object({
        budgetMinor: minorSchema,
        paidMinor: z.number().int().min(0).max(30000000000000),
        protectedMinor: z.number().int().min(0).max(30000000000000),
        availableMinor: minorSchema,
        shortfallMinor: z.number().int().min(0).max(30000000000000),
      })
      .strict()
      .optional(),
    categories: z.array(prioritySchema).max(11),
    priorities: z.array(prioritySchema).max(3).default([]),
    vendors: z
      .array(
        z
          .object({
            category: prioritySchema,
            recordedBookedCount: z.number().int().min(0).max(100),
            checklistConfirmed: z.boolean(),
          })
          .strict(),
      )
      .max(11)
      .default([]),
  })
  .strict();
export const intelligenceRequestSchema = z
  .object({
    operation: z.enum([
      "contingency-playbook",
      "ask-plan",
      "task-suggestions",
      "invitation-refinement",
    ]),
    context: intelligenceContextSchema,
    question: privateBoundedText(400).default(""),
    preferences: privateBoundedText(400).default(""),
    contingency: contingencyInputSchema
      .omit({ taskId: true })
      .extend({ taskRef: planReferenceSchema.optional() })
      .optional(),
    tone: invitationToneSchema.optional(),
    length: z.enum(["short", "detailed"]).optional(),
  })
  .strict();
export type IntelligenceRequest = z.infer<typeof intelligenceRequestSchema>;
const prose = localText(500).min(1);
export const proposedTaskSchema = z
  .object({
    title: localText(120).min(2),
    reason: prose,
    category: prioritySchema,
    daysBefore: z.number().int().min(0).max(730),
    priority: importanceSchema,
    relatedReferences: z.array(planReferenceSchema).max(3),
    assumptions: z.array(prose).max(3),
  })
  .strict();
export const intelligenceOutputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("answer"),
      answer: localText(1200).min(1),
      references: z.array(planReferenceSchema).max(8),
      ideas: z.array(prose).max(5),
      assumptions: z.array(prose).max(4),
      limitations: z.array(prose).min(1).max(4),
    })
    .strict(),
  z
    .object({
      kind: z.literal("playbook"),
      summary: prose,
      immediateActions: z.array(prose).min(1).max(6),
      alternatives: z.array(prose).min(1).max(4),
      assumptions: z.array(prose).min(1).max(4),
      limitations: z.array(prose).min(1).max(4),
      references: z.array(planReferenceSchema).max(8),
    })
    .strict(),
  z
    .object({
      kind: z.literal("tasks"),
      tasks: z.array(proposedTaskSchema).min(1).max(5),
    })
    .strict(),
  z
    .object({
      kind: z.literal("invitation"),
      opening: localText(220).min(1),
      closing: localText(220).min(1),
    })
    .strict(),
]);
export type IntelligenceOutput = z.infer<typeof intelligenceOutputSchema>;
export const intelligencePreviewSchema = z
  .object({
    section: z.enum(["answer", "playbook", "tasks", "invitation"]),
    received: z.number().int().min(1).max(10),
    text: localText(1200).optional(),
  })
  .strict();
export const intelligenceStreamSchema = z.discriminatedUnion("type", [
  z
    .object({
      version: z.literal(3),
      type: z.literal("preview"),
      data: intelligencePreviewSchema,
    })
    .strict(),
  z
    .object({
      version: z.literal(3),
      type: z.literal("complete"),
      data: intelligenceOutputSchema,
    })
    .strict(),
  z
    .object({
      version: z.literal(3),
      type: z.literal("error"),
      error: apiErrorSchema,
    })
    .strict(),
]);
export const planIntelligenceSchema = z
  .object({
    schemaVersion: z.literal(3),
    invitationFacts: invitationFactsSchema,
    exchanges: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            question: localText(400),
            answer: intelligenceOutputSchema,
            createdAt: z.string().datetime(),
            fingerprint: localText(200),
            source: z.enum(["ai", "demo", "cache"]),
          })
          .strict(),
      )
      .max(5),
    cache: z
      .array(
        z
          .object({
            fingerprint: localText(200),
            result: intelligenceOutputSchema,
            createdAt: z.string().datetime(),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();
export type PlanIntelligence = z.infer<typeof planIntelligenceSchema>;
export const emptyIntelligence = (): PlanIntelligence => ({
  schemaVersion: 3,
  invitationFacts: { time: "", venue: "", rsvp: "" },
  exchanges: [],
  cache: [],
});

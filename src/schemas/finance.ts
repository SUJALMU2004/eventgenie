import { z } from "zod";
import { dateSchema, prioritySchema } from "./event";
export const minorSchema = z.number().int().min(0).max(100000000000);
export const localText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value),
      "Remove control characters",
    );
export const vendorQuoteSchema = z
  .object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    category: prioritySchema,
    displayName: localText(100).min(1),
    quotedMinor: minorSchema,
    quoteStatus: z.enum(["estimate", "written", "confirmed"]),
    availability: z.enum(["unknown", "available", "unavailable"]),
    booking: z.enum(["considering", "shortlisted", "booked"]),
    commitmentMinor: minorSchema,
    notes: localText(500),
    inclusions: z.array(localText(120)).max(8),
    quoteDate: dateSchema.optional(),
    contact: localText(120).optional(),
    source: z.enum(["user", "demo"]),
  })
  .strict()
  .superRefine((quote, ctx) => {
    if (
      quote.booking === "booked" &&
      (quote.availability === "unavailable" || quote.commitmentMinor === 0)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "A booked vendor needs a positive commitment and cannot be unavailable.",
      });
    if (quote.booking !== "booked" && quote.commitmentMinor !== 0)
      ctx.addIssue({
        code: "custom",
        message: "Only booked vendors carry contractual commitments.",
      });
  });
export type VendorQuote = z.infer<typeof vendorQuoteSchema>;
export const expenseSchema = z
  .object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    category: prioritySchema,
    label: localText(100).min(1),
    amountMinor: minorSchema.refine(
      (value) => value > 0,
      "Enter a positive payment",
    ),
    vendorQuoteId: z.string().uuid().optional(),
  })
  .strict();
export type Expense = z.infer<typeof expenseSchema>;
export const scenarioInputSchema = z
  .object({
    totalMinor: minorSchema.refine((value) => value > 0),
    guests: z.number().int().min(1).max(10000),
    priorities: z
      .array(prioritySchema)
      .max(3)
      .refine((value) => new Set(value).size === value.length),
    contingencyPercent: z.number().int().min(0).max(50),
    knownCosts: z
      .array(
        z
          .object({ category: prioritySchema, minimumMinor: minorSchema })
          .strict(),
      )
      .max(11)
      .refine(
        (items) =>
          new Set(items.map((item) => item.category)).size === items.length,
      ),
  })
  .strict();
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
export const scenarioSchema = z
  .object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    name: localText(100).min(1),
    createdAt: z.string().datetime(),
    input: scenarioInputSchema,
  })
  .strict();
export type Scenario = z.infer<typeof scenarioSchema>;

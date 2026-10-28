import { z } from "zod";
import { vendorQuoteSchema, expenseSchema, scenarioSchema } from "./finance";
import { dependencySchema, scheduleSchema } from "./schedule";
import { planIntelligenceSchema } from "./intelligence";
import {
  operationOutputSchema,
  rescueRecommendationSchema,
} from "./operations";
export const enhancementSchema = z
  .object({
    schemaVersion: z.literal(2),
    planId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    contingencyPercent: z.number().int().min(0).max(50),
    quotes: z.array(vendorQuoteSchema).max(100),
    expenses: z.array(expenseSchema).max(200),
    scenarios: z.array(scenarioSchema).max(30),
    dependencies: z.array(dependencySchema).max(60),
    schedule: scheduleSchema.optional(),
    adoptedRescue: z.array(rescueRecommendationSchema).max(30),
    cache: z
      .array(
        z
          .object({
            fingerprint: z.string().max(200),
            result: operationOutputSchema,
            createdAt: z.string().datetime(),
          })
          .strict(),
      )
      .max(10),
    importedAt: z.string().datetime().optional(),
    intelligence: planIntelligenceSchema.optional(),
  })
  .strict();
export type PlanEnhancements = z.infer<typeof enhancementSchema>;
/** Additive migration: a Phase 1 plan receives defaults without rewriting its version-1 record. */
export function emptyEnhancements(planId: string): PlanEnhancements {
  return {
    schemaVersion: 2,
    planId,
    revision: 0,
    contingencyPercent: 10,
    quotes: [],
    expenses: [],
    scenarios: [],
    dependencies: [],
    adoptedRescue: [],
    cache: [],
  };
}

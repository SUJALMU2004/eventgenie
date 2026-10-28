import { z } from "zod";
import { eventSchema } from "@/schemas/event";
import { StorageFailure } from "./errors";
export const draftSchema = eventSchema.extend({
  title: z.string().max(100),
  city: z.string().max(100),
  date: z.string().max(10),
  guests: z.number().int().min(0).max(10000),
  budgetMinor: z.number().int().min(0).max(100000000000),
});
const envelopeSchema = z.object({ version: z.literal(1), data: z.unknown() });

export function decodeRecord<T>(value: unknown, schema: z.ZodType<T>): T {
  const envelope = envelopeSchema.safeParse(value);
  if (!envelope.success)
    throw new StorageFailure(
      "INCOMPATIBLE",
      "This saved record uses an unsupported version. It has not been changed.",
    );
  const record = schema.safeParse(envelope.data.data);
  if (!record.success)
    throw new StorageFailure(
      "CORRUPT",
      "A saved record could not be read. Other plans are unaffected.",
    );
  return record.data;
}

import { asSchema, jsonSchema, type Schema } from "ai";
import type { z } from "zod";

const cache = new WeakMap<z.ZodType, Schema>();
const localConstraints = new Set([
  "$schema",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
]);
function compactSchema(value: unknown, depth = 0): unknown {
  if (Array.isArray(value))
    return value.map((child) => compactSchema(child, depth));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !localConstraints.has(key) || (depth <= 1 && key === "minItems"),
      )
      .map(([key, child]) => [
        key,
        // Dictionary keys are field names, not JSON Schema keywords.
        ["properties", "$defs", "definitions"].includes(key) &&
        typeof child === "object" &&
        child !== null
          ? Object.fromEntries(
              Object.entries(child).map(([name, schema]) => [
                name,
                compactSchema(schema, depth + 1),
              ]),
            )
          : compactSchema(child, depth + 1),
      ]),
  );
}

/** Gemini's decoding grammar can reject nested bounds with HTTP 400.
 * Keep shape/required/enums and top-level minimum counts; enforce upper/nested bounds
 * and EVERY original constraint locally without exploding grammar complexity.
 * https://ai.google.dev/gemini-api/docs/structured-output#limitations
 */
export function geminiOutputSchema(schema: z.ZodType): Schema {
  const existing = cache.get(schema);
  if (existing) return existing;
  const full = asSchema(schema);
  const output = jsonSchema(
    async () =>
      compactSchema(await full.jsonSchema) as Awaited<Schema["jsonSchema"]>,
    { validate: full.validate },
  );
  cache.set(schema, output);
  return output;
}

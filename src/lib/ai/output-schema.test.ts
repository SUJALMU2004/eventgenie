import { describe, expect, it } from "vitest";
import { z } from "zod";
import { geminiOutputSchema } from "./output-schema";
import { recommendationsSchema } from "@/schemas/plan";
import { recommendations } from "@/test/fixtures";

describe("Gemini grammar and strict local output validation", () => {
  it("caches a provider-friendly shape without nested count/number limits", async () => {
    const output = geminiOutputSchema(recommendationsSchema);
    expect(geminiOutputSchema(recommendationsSchema)).toBe(output);
    const shape = await output.jsonSchema;
    expect(shape.type).toBe("object");
    expect(shape.required).toContain("tasks");
    expect(JSON.stringify(shape)).toContain('"enum"');
    expect(shape.properties?.tasks).toMatchObject({
      minItems: 12,
    });
    expect(shape.properties?.tasks).not.toHaveProperty("maxItems");
    expect(JSON.stringify(shape.properties?.vendors)).not.toContain(
      '"maxItems":4',
    );
    for (const keyword of ["maximum", "minimum", "maxLength", "$schema"])
      expect(JSON.stringify(shape)).not.toContain(`"${keyword}":`);
    expect(await output.validate!(recommendations)).toMatchObject({
      success: true,
    });
  });
  it.each([
    { ...recommendations, tasks: recommendations.tasks.slice(0, 1) },
    {
      ...recommendations,
      tasks: [...recommendations.tasks, ...recommendations.tasks],
    },
    {
      ...recommendations,
      tasks: recommendations.tasks.map((task) => ({
        ...task,
        daysBefore: 731,
      })),
    },
    { ...recommendations, invitations: ["x".repeat(801)] },
    { ...recommendations, overview: undefined },
  ])(
    "still rejects every original local bound and missing field",
    async (value) => {
      expect(
        await geminiOutputSchema(recommendationsSchema).validate!(value),
      ).toMatchObject({ success: false });
    },
  );
  it("preserves property names, literal values, composition and strictness", async () => {
    const original = z
      .object({
        minimum: z.literal("minItems"),
        optional: z.string().min(2).optional(),
        value: z.union([z.number().min(1), z.literal("maximum")]),
        tuple: z.tuple([z.string(), z.boolean()]),
      })
      .strict();
    const output = geminiOutputSchema(original);
    const shape = await output.jsonSchema;
    expect(shape.properties).toHaveProperty("minimum");
    expect(shape.additionalProperties).toBe(false);
    expect(JSON.stringify(shape)).toContain("anyOf");
    expect(JSON.stringify(shape)).toContain("maximum");
    expect(
      await output.validate!({
        minimum: "minItems",
        value: 2,
        tuple: ["yes", true],
      }),
    ).toMatchObject({ success: true });
    expect(
      await output.validate!({
        minimum: "minItems",
        value: 2,
        tuple: ["yes", true],
        extra: "unsafe",
      }),
    ).toMatchObject({ success: false });
    expect(
      await output.validate!({
        minimum: "minItems",
        value: 2,
        optional: "x",
        tuple: ["yes", true],
      }),
    ).toMatchObject({ success: false });
  });
});

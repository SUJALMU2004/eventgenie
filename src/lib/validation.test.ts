import { expect, it } from "vitest";
import { z, ZodError } from "zod";
import { fieldErrors, FieldValidationError } from "./validation";
it("associates domain failures with their editable field", () => {
  expect(
    fieldErrors(new FieldValidationError("dueDate", "Choose a future date")),
  ).toEqual({ dueDate: "Choose a future date" });
});
it("keeps the first error per nested field and retains form-level issues", () => {
  const result = z
    .object({ activities: z.array(z.object({ title: z.string().min(2) })) })
    .safeParse({ activities: [{ title: "" }] });
  expect(result.success).toBe(false);
  if (!result.success)
    expect(fieldErrors(result.error)).toHaveProperty("activities.0.title");
  const errors = new ZodError([
    { code: "custom", path: ["title"], message: "First" },
    { code: "custom", path: ["title"], message: "Second" },
    { code: "custom", path: [], message: "Check the whole schedule" },
  ]);
  expect(fieldErrors(errors)).toEqual({
    title: "First",
    _form: "Check the whole schedule",
  });
});
it("provides visible recoverable messages for non-field failures", () => {
  expect(fieldErrors(new Error("Try again"))).toEqual({ _form: "Try again" });
  expect(fieldErrors(null)).toEqual({ _form: "Check the highlighted fields." });
});

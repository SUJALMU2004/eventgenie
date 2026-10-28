import { ZodError } from "zod";

/** Domain rules can identify a form field without coupling to React or the DOM. */
export class FieldValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "FieldValidationError";
  }
}
export function fieldErrors(error: unknown): Record<string, string> {
  if (error instanceof FieldValidationError)
    return { [error.field]: error.message };
  if (error instanceof ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".") || "_form";
      errors[path] ??= issue.message;
    }
    return errors;
  }
  return {
    _form:
      error instanceof Error ? error.message : "Check the highlighted fields.",
  };
}

import type { ApiError } from "@/schemas/plan";

export class AppFailure extends Error {
  constructor(
    public detail: ApiError,
    public status = 500,
  ) {
    super(detail.message);
    this.name = "AppFailure";
  }
}
export function failure(
  code: string,
  message: string,
  status: number,
  retryable = false,
  retryAfter?: number,
): AppFailure {
  return new AppFailure(
    {
      code,
      message,
      retryable,
      ...(retryAfter === undefined ? {} : { retryAfter }),
    },
    status,
  );
}

export function safeError(error: unknown): AppFailure {
  if (error instanceof AppFailure) return error;
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : undefined;
  if (name === "TimeoutError")
    return failure(
      "TIMEOUT",
      "Generation took too long. Your details are safe; please retry or open a sample plan.",
      504,
      true,
    );
  if (name === "AbortError")
    return failure(
      "ABORTED",
      "Generation was cancelled. Your event details are preserved.",
      499,
    );
  if (typeof error === "object" && error !== null) {
    const status = "statusCode" in error ? error.statusCode : undefined;
    if (name === "AI_APICallError" && status === undefined && "cause" in error)
      return failure(
        "NETWORK_ERROR",
        "The server could not reach the AI service. Check its network access and retry, or use a labelled sample plan.",
        502,
        true,
      );
    if (status === 400)
      return failure(
        "PROVIDER_REQUEST_REJECTED",
        "The AI service rejected the generation request. Check the server's model and output settings, or use a labelled sample plan.",
        502,
      );
    if (status === 429) {
      const headers =
        "responseHeaders" in error ? error.responseHeaders : undefined;
      const raw =
        typeof headers === "object" &&
        headers !== null &&
        "retry-after" in headers
          ? headers["retry-after"]
          : undefined;
      const seconds =
        typeof raw === "string"
          ? /^\d+$/.test(raw)
            ? Number(raw)
            : Math.max(0, Math.ceil((Date.parse(raw) - Date.now()) / 1000))
          : 30;
      return failure(
        "RATE_LIMITED",
        "The AI request limit has been reached. Wait before retrying, or use a clearly labelled sample plan.",
        429,
        true,
        Number.isFinite(seconds) ? seconds : 30,
      );
    }
    if (status === 503 || status === 502)
      return failure(
        "PROVIDER_UNAVAILABLE",
        "The AI service is temporarily unavailable. Please retry or use a sample plan.",
        503,
        true,
      );
    if (status === 401 || status === 403 || status === 404)
      return failure(
        "PROVIDER_CONFIGURATION",
        "The AI provider could not authorise this model. Check the server configuration or use a sample plan.",
        503,
      );
  }
  if (
    [
      "AI_NoObjectGeneratedError",
      "AI_NoOutputGeneratedError",
      "ZodError",
      "SyntaxError",
    ].includes(String(name))
  )
    return failure(
      "INVALID_AI_OUTPUT",
      "The AI returned an incomplete or invalid plan. Nothing was saved. Please retry.",
      502,
      true,
    );
  if (error instanceof TypeError)
    return failure(
      "NETWORK_ERROR",
      "The AI service could not be reached. Please check your connection and retry.",
      502,
      true,
    );
  return failure(
    "INTERNAL_ERROR",
    "Something went wrong while preparing the plan. Your details are preserved.",
    500,
  );
}

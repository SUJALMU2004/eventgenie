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

type FailureSpec = readonly [
  code: string,
  message: string,
  status: number,
  retryable?: boolean,
];
const timeout: FailureSpec = [
  "TIMEOUT",
  "Generation took too long. Your details are safe; please retry or open a sample plan.",
  504,
  true,
];
const aborted: FailureSpec = [
  "ABORTED",
  "Generation was cancelled. Your event details are preserved.",
  499,
];
const unavailable: FailureSpec = [
  "PROVIDER_UNAVAILABLE",
  "The AI service is temporarily unavailable. Please retry or use a sample plan.",
  503,
  true,
];
const configuration: FailureSpec = [
  "PROVIDER_CONFIGURATION",
  "The AI provider could not authorise this model. Check the server configuration or use a sample plan.",
  503,
];
const providerFailures: Readonly<Record<number, FailureSpec>> = {
  400: [
    "PROVIDER_REQUEST_REJECTED",
    "The AI service rejected the generation request. Check the server's model and output settings, or use a labelled sample plan.",
    502,
  ],
  401: configuration,
  403: configuration,
  404: configuration,
  502: unavailable,
  503: unavailable,
};
function property(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value
    ? Reflect.get(value, key)
    : undefined;
}
function retryAfter(error: unknown): number {
  const raw = property(property(error, "responseHeaders"), "retry-after");
  if (typeof raw !== "string") return 30;
  const seconds = /^\d+$/.test(raw)
    ? Number(raw)
    : Math.max(0, Math.ceil((Date.parse(raw) - Date.now()) / 1000));
  return Number.isFinite(seconds) ? seconds : 30;
}
function providerFailure(
  error: unknown,
  name: unknown,
): AppFailure | undefined {
  const status = property(error, "statusCode");
  if (
    name === "AI_APICallError" &&
    status === undefined &&
    typeof error === "object" &&
    error !== null &&
    "cause" in error
  )
    return failure(
      "NETWORK_ERROR",
      "The server could not reach the AI service. Check its network access and retry, or use a labelled sample plan.",
      502,
      true,
    );
  if (status === 429)
    return failure(
      "RATE_LIMITED",
      "The AI request limit has been reached. Wait before retrying, or use a clearly labelled sample plan.",
      429,
      true,
      retryAfter(error),
    );
  const spec =
    typeof status === "number" ? providerFailures[status] : undefined;
  return spec ? failure(...spec) : undefined;
}
/** Return only application-owned messages; raw provider errors can contain secrets. */
export function safeError(error: unknown): AppFailure {
  if (error instanceof AppFailure) return error;
  const name = property(error, "name");
  if (name === "TimeoutError") return failure(...timeout);
  if (name === "AbortError") return failure(...aborted);
  const provider = providerFailure(error, name);
  if (provider) return provider;
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

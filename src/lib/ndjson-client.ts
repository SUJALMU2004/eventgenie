import type { z } from "zod";
import { apiErrorSchema, type ApiError } from "@/schemas/plan";
import { failure } from "./errors";
export async function consumeStructuredStream<Preview, Complete>(
  response: Response,
  preview: (value: Preview) => void,
  schema: z.ZodType<
    | { type: "preview"; data: Preview }
    | { type: "complete"; data: Complete }
    | { type: "error"; error: ApiError }
  >,
): Promise<Complete> {
  if (!response.ok) {
    const raw: unknown = await response.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(
      typeof raw === "object" && raw !== null && "error" in raw
        ? raw.error
        : null,
    );
    if (parsed.success)
      throw failure(
        parsed.data.code,
        parsed.data.message,
        response.status,
        parsed.data.retryable,
        parsed.data.retryAfter,
      );
    if (response.status === 429)
      throw failure(
        "RATE_LIMITED",
        "Too many requests. Wait a minute before retrying, or open a sample plan.",
        429,
        true,
        60,
      );
    throw failure(
      "NETWORK_ERROR",
      "The server could not complete generation. Your details are preserved.",
      response.status,
      true,
    );
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("application/x-ndjson")
  )
    throw failure(
      "INVALID_STREAM",
      "An invalid response was received. Nothing was saved.",
      502,
      true,
    );
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    receivedBytes = 0,
    complete: Complete | undefined;
  function parse(line: string) {
    const result = schema.safeParse(JSON.parse(line) as unknown);
    if (!result.success)
      throw failure(
        "INVALID_STREAM",
        "The plan response was incomplete. Nothing was saved.",
        502,
        true,
      );
    if (result.data.type === "error")
      throw failure(
        result.data.error.code,
        result.data.error.message,
        502,
        result.data.error.retryable,
        result.data.error.retryAfter,
      );
    if (complete)
      throw failure(
        "INVALID_STREAM",
        "Unexpected data after the completed plan. Nothing was saved.",
        502,
        true,
      );
    if (result.data.type === "preview") preview(result.data.data);
    else complete = result.data.data;
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
      // Allow cumulative structured previews, while bounding endless valid frames
      // and single oversized lines independently.
      if (receivedBytes > 8 * 1024 * 1024 || buffer.length > 1000000)
        throw failure(
          "INVALID_STREAM",
          "The plan response was too large. Nothing was saved.",
          502,
        );
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) parse(line);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) parse(buffer);
    if (!complete)
      throw failure(
        "INCOMPLETE_STREAM",
        "Generation ended before a complete plan arrived. Your details are preserved.",
        502,
        true,
      );
    return complete;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

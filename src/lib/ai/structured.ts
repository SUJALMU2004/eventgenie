import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import type { z } from "zod";
import { geminiOutputSchema } from "./output-schema";
export type ProviderChunk = { type: "partial" | "output"; data: unknown };
/** Shared direct-provider adapter. No tools, context caching or provider-level retries. */
export async function* streamStructured(
  schema: z.ZodType,
  system: string,
  prompt: string,
  signal: AbortSignal,
  maxOutputTokens: number,
): AsyncIterable<ProviderChunk> {
  let streamError: unknown;
  try {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    const started = performance.now();
    const result = streamText({
      model: google(process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"),
      system,
      prompt,
      output: Output.object({ schema: geminiOutputSchema(schema) }),
      maxOutputTokens,
      maxRetries: 0,
      abortSignal: signal,
      onError: ({ error }) => {
        streamError = error;
      },
    });
    const final = result.output.then(
      (data) => ({ ok: true as const, data }),
      (error) => ({ ok: false as const, error: error as unknown }),
    );
    for await (const partial of result.partialOutputStream)
      yield { type: "partial", data: partial };
    const output = await final;
    if (streamError) throw streamError;
    if (!output.ok) throw output.error;
    const usage = await result.totalUsage;
    console.info("eventgenie.generation", {
      durationMs: Math.round(performance.now() - started),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    yield { type: "output", data: output.data };
  } catch (error) {
    // The partial stream can throw a generic wrapper after onError has supplied
    // the actionable provider error. Preserve the original status for the UI.
    const reason = streamError ?? error;
    logProviderFailure(reason);
    throw reason;
  }
}

function logProviderFailure(reason: unknown) {
  const name =
    typeof reason === "object" && reason !== null && "name" in reason
      ? reason.name
      : undefined;
  const status =
    typeof reason === "object" && reason !== null && "statusCode" in reason
      ? reason.statusCode
      : undefined;
  // Operational metadata only: SDK errors can contain keys and full prompts.
  console.warn(
    "eventgenie.provider-error",
    JSON.stringify({
      type:
        typeof name === "string" && /^AI_[A-Za-z]+Error$/.test(name)
          ? name
          : "UnexpectedError",
      ...(typeof status === "number" ? { status } : {}),
    }),
  );
}

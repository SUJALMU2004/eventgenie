import { failure, safeError } from "@/lib/errors";
import type { ApiError } from "@/schemas/plan";
import type { ProviderChunk } from "./structured";
const BODY_LIMIT = 16 * 1024;
function matchesRequestOrigin(request: Request, origin: string): boolean {
  const internalUrl = new URL(request.url);
  // Next.js can use its bind hostname in request.url. Host retains the
  // browser-facing authority, including its port. Do not trust forwarded hosts.
  const host = request.headers.get("host") ?? internalUrl.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    internalUrl.protocol.slice(0, -1);
  if (!/^(http|https)$/.test(protocol) || /[\s,\\/?#@]/.test(host))
    return false;
  try {
    const target = new URL(`${protocol}://${host}`);
    return origin === target.origin;
  } catch {
    return false;
  }
}
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > BODY_LIMIT)
    throw failure(
      "REQUEST_TOO_LARGE",
      "Event details must fit within 16 KiB.",
      413,
    );
  if (!request.body)
    throw failure(
      "INVALID_REQUEST",
      "Add your event details before generating.",
      400,
    );
  const reader = request.body.getReader();
  // An attacker can stay below the byte limit while never finishing an upload.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
  const cancel = () => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) {
        await reader.cancel();
        throw failure(
          "REQUEST_TOO_LARGE",
          "Event details must fit within 16 KiB.",
          413,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw failure("INVALID_JSON", "Event details must be valid JSON.", 400);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
const delay = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });

export function createStructuredHandler<Input, Result, Preview>(options: {
  provider: (input: Input, signal: AbortSignal) => AsyncIterable<ProviderChunk>;
  configured: () => boolean;
  parseInput: (raw: unknown) => Input;
  normalize: (input: Input, raw: unknown) => Result | Promise<Result>;
  preview: (raw: unknown) => Preview | null;
  frames: {
    preview: (data: Preview) => unknown;
    complete: (data: Result) => unknown;
    error: (error: ApiError) => unknown;
  };
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}) {
  const {
    provider,
    configured,
    parseInput,
    normalize,
    preview,
    frames,
    sleep = delay,
  } = options;
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== "POST")
        return Response.json(
          {
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Use POST to generate a plan.",
              retryable: false,
            },
          },
          { status: 405, headers: { Allow: "POST" } },
        );
      if (request.signal.aborted)
        throw failure("ABORTED", "Generation was cancelled.", 499);
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          request.headers.get("content-type") ?? "",
        )
      )
        throw failure(
          "UNSUPPORTED_MEDIA_TYPE",
          "Send event details as application/json.",
          415,
        );
      const origin = request.headers.get("origin");
      if (
        (origin !== null && !matchesRequestOrigin(request, origin)) ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        throw failure(
          "ORIGIN_REJECTED",
          "Generate plans from the EventGenie website.",
          403,
        );
      const event = parseInput(await readBody(request));
      if (!configured())
        throw failure(
          "MISSING_CONFIGURATION",
          "AI generation is not configured. Set the server's Gemini key, or try a labelled sample plan.",
          503,
        );
      const controller = new AbortController();
      const signal = AbortSignal.any([
        request.signal,
        controller.signal,
        AbortSignal.timeout(90000),
      ]);
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(writer) {
          let closed = false,
            previewSent = false,
            previous = "";
          const send = (message: unknown) => {
            if (!closed && !controller.signal.aborted)
              writer.enqueue(encoder.encode(JSON.stringify(message) + "\n"));
          };
          try {
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                let output: { data: Result } | undefined;
                for await (const chunk of provider(event, signal)) {
                  signal.throwIfAborted();
                  if (output)
                    throw failure(
                      "INVALID_AI_OUTPUT",
                      "Unexpected AI data after the final result. Nothing was saved.",
                      502,
                      true,
                    );
                  if (chunk.type === "partial") {
                    const section = preview(chunk.data);
                    const serialized = JSON.stringify(section);
                    if (section && serialized !== previous) {
                      send(frames.preview(section));
                      previewSent = true;
                      previous = serialized;
                    }
                  } else {
                    output = { data: await normalize(event, chunk.data) };
                    signal.throwIfAborted();
                  }
                }
                if (!output)
                  throw failure(
                    "EMPTY_AI_OUTPUT",
                    "The AI returned no complete plan. Nothing was saved. Please retry.",
                    502,
                    true,
                  );
                signal.throwIfAborted();
                send(frames.complete(output.data));
                break;
              } catch (error) {
                const safe = safeError(signal.aborted ? signal.reason : error);
                const wait = retryDelay(
                  safe.detail,
                  attempt,
                  previewSent,
                  signal,
                );
                if (wait !== undefined) {
                  await sleep(wait, signal);
                  continue;
                }
                throw safe;
              }
            }
          } catch (error) {
            send(
              frames.error(
                safeError(signal.aborted ? signal.reason : error).detail,
              ),
            );
          } finally {
            if (!controller.signal.aborted) {
              writer.close();
              closed = true;
            }
          }
        },
        cancel() {
          controller.abort(new DOMException("Cancelled", "AbortError"));
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      const safe = safeError(error);
      return Response.json(
        { error: safe.detail },
        {
          status: safe.status,
          headers: {
            "Cache-Control": "no-store",
            ...(safe.detail.retryAfter === undefined
              ? {}
              : { "Retry-After": String(safe.detail.retryAfter) }),
          },
        },
      );
    }
  };
}

function retryDelay(
  error: ApiError,
  attempt: number,
  previewSent: boolean,
  signal: AbortSignal,
): number | undefined {
  const transient = [
    "PROVIDER_UNAVAILABLE",
    "NETWORK_ERROR",
    "RATE_LIMITED",
  ].includes(error.code);
  const wait =
    error.retryAfter === undefined
      ? 500 * 2 ** attempt
      : error.retryAfter * 1000;
  return attempt === 0 &&
    !previewSent &&
    transient &&
    wait <= 2000 &&
    !signal.aborted
    ? wait
    : undefined;
}

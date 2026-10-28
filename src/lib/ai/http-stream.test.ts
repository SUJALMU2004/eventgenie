import { afterEach, describe, expect, it, vi } from "vitest";
import { createStructuredHandler } from "./http-stream";
import type { ProviderChunk } from "./structured";
import { consumeStructuredStream } from "@/lib/ndjson-client";
import { z } from "zod";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const frames = {
  preview: (data: string) => ({ type: "preview", data }),
  complete: (data: string) => ({ type: "complete", data }),
  error: (error: unknown) => ({ type: "error", error }),
};
const request = (body: BodyInit = "{}", signal?: AbortSignal) =>
  new Request("http://localhost/api/plans/intelligence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  });
function handler(
  provider: () => AsyncIterable<ProviderChunk>,
  normalize: (input: unknown, raw: unknown) => string | Promise<string> = (
    _input,
    raw,
  ) => z.string().parse(raw),
) {
  return createStructuredHandler({
    provider,
    configured: () => true,
    parseInput: (raw) => raw,
    normalize,
    preview: (raw) => (typeof raw === "string" ? raw : null),
    frames,
  });
}
const source = async function* () {
  yield { type: "output" as const, data: "complete" };
};

describe("shared transport release hardening", () => {
  it("measures meaningful progressive delivery through the actual handler", async () => {
    const pause = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const provider = async function* () {
      await pause(20);
      yield { type: "partial" as const, data: "A meaningful event overview" };
      await pause(40);
      yield { type: "output" as const, data: "Validated complete result" };
    };
    const started = performance.now(),
      response = await handler(provider)(request()),
      reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      '"type":"preview"',
    );
    const firstPreviewMs = Math.round(performance.now() - started);
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      '"type":"complete"',
    );
    expect((await reader.read()).done).toBe(true);
    reader.releaseLock();
    console.info("eventgenie.mock-stream-measurement", {
      fixtureDelaysMs: [20, 40],
      firstPreviewMs,
      completeMs: Math.round(performance.now() - started),
    });
  });
  it.each([false, true])(
    "bounds stalled uploads even when source cancellation rejects: %s",
    async (rejectCancel) => {
      const deadline = new AbortController(),
        cancel = vi.fn(() =>
          rejectCancel
            ? Promise.reject(new Error("private cancellation error"))
            : undefined,
        ),
        provider = vi.fn(source);
      vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
      const pending = handler(provider)(
        request(new ReadableStream({ cancel })),
      );
      deadline.abort(new DOMException("Deadline", "TimeoutError"));
      const response = await pending;
      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({
        error: { code: "TIMEOUT" },
      });
      expect(provider).not.toHaveBeenCalled();
      expect(cancel).toHaveBeenCalledOnce();
    },
  );
  it("uses the real bounded backoff for one transient failure before a preview", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const provider = async function* () {
      if (++attempts === 1) throw { statusCode: 503 };
      yield { type: "output" as const, data: "recovered" };
    };
    const response = await handler(provider)(request()),
      pending = response.text();
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toContain('"data":"recovered"');
    expect(attempts).toBe(2);
  });
  it("aborts a pending retry delay without another provider attempt", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let attempts = 0;
    const provider = async function* (): AsyncIterable<ProviderChunk> {
      attempts++;
      throw { statusCode: 503 };
    };
    const response = await handler(provider)(request("{}", controller.signal)),
      pending = response.text();
    await vi.advanceTimersByTimeAsync(0);
    controller.abort(new DOMException("Cancelled", "AbortError"));
    expect(await pending).toContain('"code":"ABORTED"');
    expect(attempts).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels a body read immediately on client disconnect", async () => {
    const controller = new AbortController(),
      cancel = vi.fn(),
      provider = vi.fn(source);
    const pending = handler(provider)(
      request(new ReadableStream({ cancel }), controller.signal),
    );
    controller.abort(new DOMException("Disconnected", "AbortError"));
    const response = await pending;
    expect(response.status).toBe(499);
    expect(provider).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("does not complete after cancellation during asynchronous normalization", async () => {
    const controller = new AbortController();
    const response = await handler(source, async () => {
      controller.abort(new DOMException("Cancelled", "AbortError"));
      return "must not complete";
    })(request("{}", controller.signal));
    const text = await response.text();
    expect(text).toContain('"code":"ABORTED"');
    expect(text).not.toContain('"type":"complete"');
  });
  it.each(["duplicate output", "late preview", "late provider exception"])(
    "rejects %s without emitting a completion",
    async (mode) => {
      const provider = async function* () {
        yield { type: "output" as const, data: "candidate" };
        if (mode === "late provider exception")
          throw new Error("private provider error");
        yield {
          type:
            mode === "late preview"
              ? ("partial" as const)
              : ("output" as const),
          data: "unexpected",
        };
      };
      const text = await (await handler(provider)(request())).text();
      expect(text).toContain('"type":"error"');
      expect(text).not.toContain('"type":"complete"');
      expect(text).not.toContain("private provider error");
    },
  );
  it("caps cumulative stream bytes even when each frame fits", async () => {
    const data =
      JSON.stringify({ type: "preview", data: "é".repeat(1000) }) + "\n";
    const preview = vi.fn(),
      cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(writer) {
          for (let n = 0; n < 4200; n++)
            writer.enqueue(new TextEncoder().encode(data));
        },
        cancel,
      }),
      { headers: { "Content-Type": "application/x-ndjson" } },
    );
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("preview"), data: z.string() }),
      z.object({ type: z.literal("complete"), data: z.string() }),
    ]);
    await expect(
      consumeStructuredStream(response, preview, schema),
    ).rejects.toMatchObject({ detail: { code: "INVALID_STREAM" } });
    expect(cancel).toHaveBeenCalledOnce();
    expect(preview.mock.calls.length).toBeLessThan(4200);
  });
});

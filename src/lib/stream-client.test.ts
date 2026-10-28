import { describe, expect, it, vi } from "vitest";
import { consumePlanStream } from "./stream-client";
import { plan, recommendations } from "@/test/fixtures";
const headers = { "Content-Type": "application/x-ndjson" };
const line = (data: unknown) => JSON.stringify(data) + "\n";
describe("progressive client transport", () => {
  it("consumes real chunk boundaries and validates the final plan", async () => {
    const text =
      line({ type: "preview", data: { overview: recommendations.overview } }) +
      line({ type: "complete", data: plan });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const bytes = new TextEncoder().encode(text);
        for (let i = 0; i < bytes.length; i += 17)
          controller.enqueue(bytes.slice(i, i + 17));
        controller.close();
      },
    });
    const preview = vi.fn();
    expect(
      await consumePlanStream(new Response(stream, { headers }), preview),
    ).toEqual(plan);
    expect(preview).toHaveBeenCalledWith({
      overview: recommendations.overview,
    });
  });
  it("supports a final line without a trailing newline and blank lines", async () => {
    expect(
      await consumePlanStream(
        new Response("\n" + JSON.stringify({ type: "complete", data: plan }), {
          headers,
        }),
        vi.fn(),
      ),
    ).toEqual(plan);
  });
  it("propagates safe API errors", async () => {
    const response = Response.json(
      {
        error: {
          code: "MISSING_CONFIGURATION",
          message: "Set the server key",
          retryable: false,
        },
      },
      { status: 503 },
    );
    await expect(consumePlanStream(response, vi.fn())).rejects.toMatchObject({
      detail: { code: "MISSING_CONFIGURATION" },
    });
  });
  it("handles platform-generated HTML 429 and server errors", async () => {
    await expect(
      consumePlanStream(
        new Response("<html>rate limited</html>", { status: 429 }),
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      detail: { code: "RATE_LIMITED", retryAfter: 60 },
    });
    await expect(
      consumePlanStream(new Response("bad gateway", { status: 502 }), vi.fn()),
    ).rejects.toMatchObject({ detail: { code: "NETWORK_ERROR" } });
  });
  it.each([
    new Response(null, { headers }),
    new Response("data", { headers: { "Content-Type": "text/html" } }),
  ])("rejects a missing or incorrect stream", async (response) => {
    await expect(consumePlanStream(response, vi.fn())).rejects.toMatchObject({
      detail: { code: "INVALID_STREAM" },
    });
  });
  it.each(["", line({ type: "preview", data: {} })])(
    "does not save partial-only responses",
    async (text) => {
      await expect(
        consumePlanStream(new Response(text, { headers }), vi.fn()),
      ).rejects.toMatchObject({ detail: { code: "INCOMPLETE_STREAM" } });
    },
  );
  it.each([
    line({ type: "complete", data: {} }),
    line({ type: "other" }),
    "broken JSON",
  ])("rejects malformed messages", async (text) => {
    await expect(
      consumePlanStream(new Response(text, { headers }), vi.fn()),
    ).rejects.toThrow();
  });
  it("rejects a terminal error even after a preview", async () => {
    const text =
      line({ type: "preview", data: { overview: recommendations.overview } }) +
      line({
        type: "error",
        error: { code: "TIMEOUT", message: "Try again", retryable: true },
      });
    await expect(
      consumePlanStream(new Response(text, { headers }), vi.fn()),
    ).rejects.toMatchObject({ detail: { code: "TIMEOUT" } });
  });
  it("refuses data after completion", async () => {
    const text =
      line({ type: "complete", data: plan }) +
      line({ type: "preview", data: {} });
    await expect(
      consumePlanStream(new Response(text, { headers }), vi.fn()),
    ).rejects.toMatchObject({ detail: { code: "INVALID_STREAM" } });
  });
  it("bounds unframed responses", async () => {
    await expect(
      consumePlanStream(
        new Response("x".repeat(1000001), { headers }),
        vi.fn(),
      ),
    ).rejects.toMatchObject({ detail: { code: "INVALID_STREAM" } });
  });
  it("surfaces stream interruption", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.error(new DOMException("Stopped", "AbortError"));
      },
    });
    await expect(
      consumePlanStream(new Response(stream, { headers }), vi.fn()),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

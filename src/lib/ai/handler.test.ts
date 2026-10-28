import { describe, expect, it, vi } from "vitest";
import { createGenerateHandler } from "./handler";
import type { GenerateProvider } from "./provider";
import { consumePlanStream } from "@/lib/stream-client";
import { clock, event, recommendations } from "@/test/fixtures";
import { eventTypes } from "@/schemas/event";
import { demoEvent, demoRecommendations } from "@/data/demo";

const success: GenerateProvider = async function* (input) {
  const data = demoRecommendations(input);
  yield { type: "partial", data: { overview: data.overview } };
  yield { type: "partial", data };
  yield { type: "output", data };
};
const request = (
  body: unknown = event,
  headers: HeadersInit = {
    "Content-Type": "application/json",
    Origin: "http://localhost",
  },
) =>
  new Request("http://localhost/api/plans/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
const handler = (provider = success, configured = true) =>
  createGenerateHandler(
    provider,
    () => configured,
    clock,
    async () => undefined,
  );
describe("generation HTTP boundary", () => {
  it.each(eventTypes)("streams validated %s plans", async (type) => {
    const preview = vi.fn(),
      response = await handler()(request(demoEvent(type, clock)));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const result = await consumePlanStream(response, preview);
    expect(result.event.eventType).toBe(type);
    expect(result.source).toBe("ai");
    expect(preview).toHaveBeenCalledTimes(2);
  });
  it("delivers previews before the provider completes", async () => {
    let finish: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const provider: GenerateProvider = async function* () {
      yield { type: "partial", data: { overview: recommendations.overview } };
      await gate;
      yield { type: "output", data: recommendations };
    };
    const response = await handler(provider)(request());
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('"type":"preview"');
    finish?.();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      '"type":"complete"',
    );
    expect((await reader.read()).done).toBe(true);
  });
  it.each([
    ["content-type", "text/plain", 415],
    ["origin", "https://attacker.example", 403],
    ["sec-fetch-site", "cross-site", 403],
    ["content-length", "20000", 413],
  ])("rejects invalid %s", async (header, value, status) => {
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.set(header, value);
    const response = await handler()(request(event, headers));
    expect(response.status).toBe(status);
  });
  it("allows same-site browser requests and non-browser clients without treating origin as authentication", async () => {
    expect(
      (
        await handler()(
          request(event, { "Content-Type": "application/json; charset=utf-8" }),
        )
      ).status,
    ).toBe(200);
  });
  it.each([
    ["127.0.0.1:3000", "http://127.0.0.1:3000", undefined, 200],
    ["localhost:3000", "http://localhost:3000", undefined, 200],
    ["[::1]:3000", "http://[::1]:3000", undefined, 200],
    ["events.example", "https://events.example", "https", 200],
    ["localhost:3000", "http://localhost:3001", undefined, 403],
    ["localhost:3000", "http://127.0.0.1:3000", undefined, 403],
    ["localhost:3000", "https://attacker.example", undefined, 403],
    ["localhost:3000", "null", undefined, 403],
    ["localhost:3000", "", undefined, 403],
    ["localhost:3000", "http://localhost:3000/path", undefined, 403],
    ["localhost:3000", "http://localhost:3000", "https,http", 403],
    [
      "localhost:3000@attacker.example",
      "http://attacker.example",
      undefined,
      403,
    ],
    ["localhost:3000/path", "http://localhost:3000", undefined, 403],
    [
      "localhost:3000,attacker.example",
      "http://localhost:3000",
      undefined,
      403,
    ],
    ["[invalid", "http://localhost:3000", undefined, 403],
  ])(
    "validates browser-facing host %s and origin %s",
    async (host, origin, protocol, status) => {
      const headers = new Headers({
        "Content-Type": "application/json",
        Host: host,
        Origin: origin,
        "Sec-Fetch-Site": "same-origin",
        // A client-supplied forwarded host must never authorize another origin.
        "X-Forwarded-Host": "attacker.example",
      });
      if (protocol) headers.set("X-Forwarded-Proto", protocol);
      const response = await handler()(request(event, headers));
      expect(response.status).toBe(status);
      if (status === 200) await response.text();
      else
        expect(await response.json()).toMatchObject({
          error: { code: "ORIGIN_REJECTED" },
        });
    },
  );
  it("rejects an oversized actual body without trusting content-length", async () => {
    const response = await handler()(
      request(
        { ...event, notes: "x".repeat(20000) },
        { "Content-Type": "application/json", "Content-Length": "1" },
      ),
    );
    expect(response.status).toBe(413);
  });
  it("rejects malformed or empty bodies", async () => {
    const invalid = new Request("http://localhost/api/plans/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect((await handler()(invalid)).status).toBe(400);
    const missing = new Request("http://localhost/api/plans/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect((await handler()(missing)).status).toBe(400);
  });
  it.each([
    { ...event, eventType: "chat" },
    { ...event, date: "2020-01-01" },
    { ...event, guests: 0 },
    {},
  ])("rejects invalid requirements without invoking Gemini", async (input) => {
    const provider = vi.fn(success);
    const response = await handler(provider)(request(input));
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it("builds and responds safely without a key", async () => {
    const response = await handler(success, false)(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "MISSING_CONFIGURATION" },
    });
  });
  it("rejects methods other than POST", async () => {
    const response = await handler()(
      new Request("http://localhost/api/plans/generate"),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
  it("handles pre-aborted requests", async () => {
    const abort = new AbortController();
    abort.abort();
    const value = new Request(request(), { signal: abort.signal });
    expect((await handler()(value)).status).toBe(499);
  });
});
describe("provider resilience", () => {
  it.each([
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
    [401, "PROVIDER_CONFIGURATION"],
  ])("safely reports provider %s", async (statusCode, code) => {
    const provider: GenerateProvider = async function* () {
      throw {
        statusCode,
        message: "secret provider details",
        responseHeaders: { "retry-after": "30" },
      };
    };
    const text = await (await handler(provider)(request())).text();
    expect(text).toContain(code);
    expect(text).not.toContain("secret provider details");
  });
  it("makes at most one automatic retry before a preview", async () => {
    let attempts = 0;
    const provider: GenerateProvider = async function* () {
      attempts++;
      if (attempts === 1) throw { statusCode: 503 };
      yield { type: "output", data: recommendations };
    };
    const result = await consumePlanStream(
      await handler(provider)(request()),
      vi.fn(),
    );
    expect(result.source).toBe("ai");
    expect(attempts).toBe(2);
  });
  it("respects short Retry-After hints", async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);
    const provider: GenerateProvider = async function* () {
      attempts++;
      if (attempts === 1)
        throw { statusCode: 429, responseHeaders: { "retry-after": "1" } };
      yield { type: "output", data: recommendations };
    };
    await (
      await createGenerateHandler(provider, () => true, clock, sleep)(request())
    ).text();
    expect(sleep).toHaveBeenCalledWith(1000, expect.any(AbortSignal));
    expect(attempts).toBe(2);
  });
  it("does not restart a stream after preview delivery", async () => {
    let attempts = 0;
    const provider: GenerateProvider = async function* () {
      attempts++;
      yield { type: "partial", data: { overview: recommendations.overview } };
      throw { statusCode: 503 };
    };
    const text = await (await handler(provider)(request())).text();
    expect(text).toContain('"type":"preview"');
    expect(text).toContain('"type":"error"');
    expect(attempts).toBe(1);
  });
  it("deduplicates previews and ignores incomplete sections", async () => {
    const provider: GenerateProvider = async function* () {
      yield {
        type: "partial",
        data: { overview: { description: "unfinished" } },
      };
      yield { type: "partial", data: { overview: recommendations.overview } };
      yield { type: "partial", data: { overview: recommendations.overview } };
      yield { type: "output", data: recommendations };
    };
    const preview = vi.fn();
    await consumePlanStream(await handler(provider)(request()), preview);
    expect(preview).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, "bad JSON", {}, { ...recommendations, tasks: [] }])(
    "refuses malformed model output",
    async (output) => {
      const provider: GenerateProvider = async function* () {
        yield { type: "output", data: output };
      };
      await expect(
        consumePlanStream(await handler(provider)(request()), vi.fn()),
      ).rejects.toMatchObject({ detail: { code: "INVALID_AI_OUTPUT" } });
    },
  );
  it("rejects a provider that ends without a final object", async () => {
    const provider: GenerateProvider = async function* () {
      yield { type: "partial", data: {} };
    };
    await expect(
      consumePlanStream(await handler(provider)(request()), vi.fn()),
    ).rejects.toMatchObject({ detail: { code: "EMPTY_AI_OUTPUT" } });
  });
  it("handles timeout and network failure", async () => {
    for (const error of [
      new DOMException("timeout", "TimeoutError"),
      new TypeError("fetch failed"),
    ]) {
      const provider: GenerateProvider = async function* () {
        throw error;
      };
      await expect(
        consumePlanStream(await handler(provider)(request()), vi.fn()),
      ).rejects.toThrow();
    }
  });
  it("propagates a cancellation to the upstream signal", async () => {
    const abort = new AbortController();
    const provider: GenerateProvider = async function* (_event, signal) {
      yield { type: "partial", data: { overview: recommendations.overview } };
      abort.abort(new DOMException("Cancelled", "AbortError"));
      signal.throwIfAborted();
    };
    const response = await handler(provider)(
      new Request(request(), { signal: abort.signal }),
    );
    const text = await response.text();
    expect(text).toContain("ABORTED");
    expect(text).not.toContain('"type":"complete"');
  });
});

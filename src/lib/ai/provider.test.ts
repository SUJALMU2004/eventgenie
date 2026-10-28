import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { event, recommendations } from "@/test/fixtures";
const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
  google: vi.fn(),
  createGoogle: vi.fn(),
}));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  streamText: mocks.streamText,
  Output: { object: vi.fn((value) => value) },
}));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: mocks.createGoogle,
}));
import { generateWithGemini } from "./provider";

beforeEach(() => {
  mocks.google.mockReturnValue({ modelId: "mock-google-model" });
  mocks.createGoogle.mockReturnValue(mocks.google);
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-placeholder-not-a-real-key");
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
function response(output: Promise<unknown> = Promise.resolve(recommendations)) {
  return {
    partialOutputStream: (async function* () {
      yield { overview: recommendations.overview };
    })(),
    output,
    totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 200 }),
  };
}
describe("direct Gemini SDK integration", () => {
  it("uses structured genuine streaming, bounded tokens, no tools and a server-only key", async () => {
    mocks.streamText.mockReturnValue(response());
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const chunks = [];
    const signal = new AbortController().signal;
    for await (const chunk of generateWithGemini(event, signal))
      chunks.push(chunk);
    expect(chunks.map((chunk) => chunk.type)).toEqual(["partial", "output"]);
    expect(mocks.createGoogle).toHaveBeenCalledWith({
      apiKey: "test-placeholder-not-a-real-key",
    });
    expect(mocks.google).toHaveBeenCalledWith("gemini-3.5-flash-lite");
    const options = mocks.streamText.mock.calls[0][0];
    expect(options.maxOutputTokens).toBe(8000);
    expect(options.maxRetries).toBe(0);
    expect(options.abortSignal).toBe(signal);
    expect(options.tools).toBeUndefined();
    expect(options.prompt).not.toContain("test-placeholder-not-a-real-key");
    expect(info).toHaveBeenCalledWith(
      "eventgenie.generation",
      expect.objectContaining({ inputTokens: 100, outputTokens: 200 }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain(event.title);
    info.mockRestore();
  });
  it("allows server-side model configuration", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash-lite");
    mocks.streamText.mockReturnValue(response());
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    for await (const chunk of generateWithGemini(
      event,
      new AbortController().signal,
    ))
      expect(chunk).toBeDefined();
    expect(mocks.google).toHaveBeenCalledWith("gemini-2.5-flash-lite");
    info.mockRestore();
  });
  it("propagates malformed or missing structured output", async () => {
    const error = new Error("Missing output");
    mocks.streamText.mockReturnValue(response(Promise.reject(error)));
    const collect = async () => {
      for await (const chunk of generateWithGemini(
        event,
        new AbortController().signal,
      ))
        expect(chunk.type).toBe("partial");
    };
    await expect(collect()).rejects.toBe(error);
  });
  it("preserves provider errors without default raw SDK logging", async () => {
    const providerError = { statusCode: 429 };
    mocks.streamText.mockImplementation((options) => {
      options.onError({ error: providerError });
      return response(Promise.resolve(undefined));
    });
    const collect = async () => {
      for await (const chunk of generateWithGemini(
        event,
        new AbortController().signal,
      ))
        expect(chunk.type).toBe("partial");
    };
    await expect(collect()).rejects.toBe(providerError);
  });
  it("preserves the provider's 400 when the partial stream throws a generic wrapper", async () => {
    const providerError = {
      name: "AI_APICallError",
      statusCode: 400,
      message: "private request",
      requestBodyValues: event,
    };
    mocks.streamText.mockImplementation((options) => {
      options.onError({ error: providerError });
      return {
        ...response(Promise.reject(new Error("generic output wrapper"))),
        partialOutputStream: (async function* () {
          throw new Error("generic stream wrapper");
          yield undefined;
        })(),
      };
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const collect = async () => {
      for await (const chunk of generateWithGemini(
        event,
        new AbortController().signal,
      ))
        expect(chunk).toBeUndefined();
    };
    await expect(collect()).rejects.toBe(providerError);
    expect(warn).toHaveBeenCalledWith(
      "eventgenie.provider-error",
      JSON.stringify({
        type: "AI_APICallError",
        status: 400,
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(event.title);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private request");
    warn.mockRestore();
  });
});

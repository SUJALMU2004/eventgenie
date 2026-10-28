import { describe, expect, it } from "vitest";
import { failure, safeError } from "./errors";
describe("safe stable errors", () => {
  it.each([
    [400, "PROVIDER_REQUEST_REJECTED"],
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
    [502, "PROVIDER_UNAVAILABLE"],
    [401, "PROVIDER_CONFIGURATION"],
    [403, "PROVIDER_CONFIGURATION"],
    [404, "PROVIDER_CONFIGURATION"],
  ])("maps provider %s without disclosing details", (statusCode, code) => {
    const result = safeError({
      statusCode,
      message: "private provider details secret",
    });
    expect(result.detail.code).toBe(code);
    expect(JSON.stringify(result.detail)).not.toContain("secret");
  });
  it.each(["AI_NoObjectGeneratedError", "ZodError", "SyntaxError"])(
    "handles %s",
    (name) => {
      const error = new Error("private");
      error.name = name;
      expect(safeError(error).detail.code).toBe("INVALID_AI_OUTPUT");
    },
  );
  it("handles aborts, timeout and network errors", () => {
    expect(
      safeError(new DOMException("cancelled", "AbortError")).detail.code,
    ).toBe("ABORTED");
    expect(
      safeError(new DOMException("timeout", "TimeoutError")).detail.code,
    ).toBe("TIMEOUT");
    expect(safeError(new TypeError("fetch failed")).detail.code).toBe(
      "NETWORK_ERROR",
    );
  });
  it("preserves intentional safe errors", () => {
    const original = failure("EXPECTED", "Safe text", 400, true, 4);
    expect(safeError(original)).toBe(original);
  });
  it("handles unknown objects safely", () => {
    for (const value of [
      null,
      undefined,
      { statusCode: 500 },
      new Error("private"),
      42,
    ])
      expect(safeError(value).detail.code).toBe("INTERNAL_ERROR");
  });
  it.each(["EACCES", "ECONNREFUSED", "ENOTFOUND"])(
    "maps an SDK-wrapped %s network failure safely",
    (code) => {
      const error = {
        name: "AI_APICallError",
        cause: { code, message: "private request and credential" },
      };
      expect(safeError(error).detail).toMatchObject({
        code: "NETWORK_ERROR",
        retryable: true,
      });
      expect(JSON.stringify(safeError(error).detail)).not.toContain(
        "credential",
      );
    },
  );
  it("respects bounded Retry-After values and malformed headers", () => {
    expect(
      safeError({ statusCode: 429, responseHeaders: { "retry-after": "2" } })
        .detail.retryAfter,
    ).toBe(2);
    expect(
      safeError({
        statusCode: 429,
        responseHeaders: { "retry-after": "invalid" },
      }).detail.retryAfter,
    ).toBe(30);
    expect(
      safeError({
        statusCode: 429,
        responseHeaders: {
          "retry-after": new Date(Date.now() + 30000).toUTCString(),
        },
      }).detail.retryAfter,
    ).toBeGreaterThan(0);
  });
});

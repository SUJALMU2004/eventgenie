import { afterEach, expect, it, vi } from "vitest";
import config from "../../next.config";
afterEach(() => vi.unstubAllEnvs());
async function policy() {
  if (!config.headers) throw new Error("Security headers are missing");
  const groups = await config.headers();
  return groups[0].headers.find(
    (header) => header.key === "Content-Security-Policy",
  )?.value;
}
it("restricts production execution and framing", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(await policy()).not.toContain("unsafe-eval");
  expect(await policy()).toContain("frame-ancestors 'none'");
  expect(await policy()).toContain("object-src 'none'");
});
it("permits React debugging eval only in development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(await policy()).toContain("unsafe-eval");
});

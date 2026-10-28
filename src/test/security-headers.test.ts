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
  expect(await policy()).toContain("script-src-attr 'none'");
  expect(await policy()).toContain("frame-src 'none'");
  expect(await policy()).toContain("base-uri 'none'");
});
it("scopes one-year HSTS to HTTPS responses without subdomain commitments", async () => {
  const groups = await config.headers!();
  const hsts = groups.find((group) =>
    group.headers.some((header) => header.key === "Strict-Transport-Security"),
  );
  expect(hsts).toMatchObject({
    has: [{ type: "header", key: "x-forwarded-proto", value: "https" }],
    headers: [{ key: "Strict-Transport-Security", value: "max-age=31536000" }],
  });
  expect(
    groups[0].headers.some(
      (header) => header.key === "Strict-Transport-Security",
    ),
  ).toBe(false);
});
it("permits React debugging eval only in development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(await policy()).toContain("unsafe-eval");
});

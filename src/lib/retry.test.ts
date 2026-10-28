import { expect, it } from "vitest";
import { retryDeadline, retryWaitSeconds } from "./retry";
it("computes cooldowns without updating render-time state", () => {
  expect(retryDeadline(30, 1000)).toBe(31000);
  expect(retryWaitSeconds(31000, 1001)).toBe(30);
  expect(retryWaitSeconds(1, 1000)).toBe(0);
  expect(retryDeadline(1)).toBeGreaterThan(0);
  expect(retryWaitSeconds(0)).toBe(0);
});

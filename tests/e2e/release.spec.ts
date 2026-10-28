import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  validateIntelligenceRequest,
  offlineIntelligence,
} from "../../src/lib/ai/intelligence";
test.describe.configure({ timeout: 90000 });
const axe = async (page: Page) => {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
};
async function saved(page: Page) {
  await page.goto("/plan?demo=community");
  for (let n = 0; n < 3; n++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create sample plan · no AI call" })
    .click();
  await page.getByRole("link", { name: "Open saved copy" }).click();
  await page.waitForURL(/\/plans\/[a-f0-9-]+$/);
  await page
    .getByRole("button", { name: "Open advanced planning", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your next best steps", exact: true }),
  ).toBeVisible();
}
test("release headers, responsive pages, reduced motion and form-boundary contrast", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/plan?type=wedding", "/plans", "/privacy"]) {
      const response = await page.goto(route);
      expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
      expect(response?.headers()["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      expect(response?.headers()["content-security-policy"]).not.toContain(
        "unsafe-eval",
      );
      expect(response?.headers()["x-frame-options"]).toBe("DENY");
      expect(response?.headers()["permissions-policy"]).toContain("camera=()");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}`,
      ).toBe(true);
      if (width === 320) await axe(page);
    }
  }
  await page.goto("/plan?type=birthday");
  const input = page.getByRole("textbox", { name: "Event title", exact: true });
  await expect(input).toBeVisible();
  const contrast = await input.evaluate((element) => {
    const css = getComputedStyle(element);
    function luminance(color: string) {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const c = value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
      return channels.reduce(
        (sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index],
        0,
      );
    }
    const a = luminance(css.borderTopColor),
      b = luminance(css.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(input).toBeFocused();
  await axe(page);
});
test("expanded decisions reflow at 320px and 200-percent-equivalent CSS width", async ({
  page,
}) => {
  await saved(page);
  await page
    .locator(".decision-studio details")
    .evaluateAll((elements) =>
      elements.forEach((element) => element.setAttribute("open", "")),
    );
  for (const width of [320, 375, 640, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `expanded dashboard at ${width}`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await axe(page);
  await page.screenshot({ path: "artifacts/phase4-dashboard-320.png" });
});
test("confirmation contains keyboard focus, escapes safely and restores the trigger", async ({
  page,
}, testInfo) => {
  await saved(page);
  const started = performance.now();
  await page.locator(".task-list input[type=checkbox]").first().check();
  await expect(
    page.getByText("Checklist progress saved in this browser."),
  ).toBeVisible();
  await testInfo.attach("checklist-latency.json", {
    body: JSON.stringify({
      clickToSavedConfirmationMs: Math.round(performance.now() - started),
    }),
    contentType: "application/json",
  });
  const trigger = page.getByRole("button", {
    name: "Reload saved version",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await axe(page);
  for (let n = 0; n < 5; n++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate(
        (element) =>
          // Native dialogs may move focus to browser chrome between cycles;
          // body is then active, while background page controls remain inert.
          element.matches(":modal") &&
          (element.contains(document.activeElement) ||
            document.activeElement === document.body),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test("reviewed answer, cancellation, error accessibility, plain-text output and measured cache reuse", async ({
  page,
}, testInfo) => {
  const exceptions: string[] = [];
  page.on("pageerror", (error) => exceptions.push(error.name));
  await saved(page);
  const ask = page.locator("#ask-eventgenie");
  await ask.locator(":scope > summary").click();
  const button = ask.getByRole("button", {
    name: "Generate plan answer with AI",
    exact: true,
  });
  let calls = 0;
  const malicious = '<img src=x onerror="alert(document.cookie)">';
  await page.route("**/api/plans/intelligence", async (route) => {
    calls++;
    const input = validateIntelligenceRequest(route.request().postDataJSON());
    const output = offlineIntelligence(input);
    if (output.kind !== "answer") throw new Error("Wrong operation");
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          version: 3,
          type: "complete",
          data: { ...output, answer: malicious },
        }) + "\n",
    });
  });
  let start = performance.now();
  await button.click();
  await expect(
    ask.getByText("AI preview · not applied", { exact: true }),
  ).toBeVisible();
  const missMs = Math.round(performance.now() - start);
  await expect(ask.getByText(malicious, { exact: true })).toBeVisible();
  await expect(ask.locator("img,script")).toHaveCount(0);
  await ask.getByRole("button", { name: "Reject plan answer preview" }).click();
  start = performance.now();
  await button.click();
  await expect(
    ask.getByText("Cached AI preview · not applied", { exact: true }),
  ).toBeVisible();
  const hitMs = Math.round(performance.now() - start);
  expect(calls).toBe(1);
  await testInfo.attach("cache-latency.json", {
    body: JSON.stringify({ mockDelayMs: 200, missMs, hitMs, requests: calls }),
    contentType: "application/json",
  });
  await ask.getByRole("button", { name: "Reject plan answer preview" }).click();
  await ask
    .getByLabel("Your plan-specific question")
    .fill("Which vendors need review?");
  await page.unroute("**/api/plans/intelligence");
  await page.route("**/api/plans/intelligence", () => {});
  await button.click();
  await expect(
    ask.getByRole("button", { name: "Cancel plan answer" }),
  ).toBeVisible();
  await axe(page);
  await ask.getByRole("button", { name: "Cancel plan answer" }).click();
  await expect(ask.getByRole("alert")).toContainText("cancelled");
  await axe(page);
  expect(exceptions).toEqual([]);
});

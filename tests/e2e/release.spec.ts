import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gzipSync } from "node:zlib";
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
  await page.screenshot({ path: "artifacts/dashboard-320.png" });
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
test("CSP blocks inline handlers, frames and base changes while HTTP stays usable", async ({
  page,
  request,
}) => {
  const http = await request.get("/");
  expect(http.headers()["strict-transport-security"]).toBeUndefined();
  const tls = await request.get("/", {
    headers: { "x-forwarded-proto": "https" },
  });
  expect(tls.headers()["strict-transport-security"]).toBe("max-age=31536000");
  for (const directive of [
    "script-src-attr 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
  ])
    expect(http.headers()["content-security-policy"]).toContain(directive);
  await page.goto("/");
  const originalBase = await page.evaluate(() => document.baseURI);
  await page.evaluate(() => {
    const violations: string[] = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(event.effectiveDirective);
      document.documentElement.dataset.cspViolations =
        JSON.stringify(violations);
    });
    const button = document.createElement("button");
    button.setAttribute(
      "onclick",
      "document.documentElement.dataset.inlineExecuted='yes'",
    );
    document.body.append(button);
    button.click();
    button.remove();
    const base = document.createElement("base");
    base.href = "https://example.invalid/";
    document.head.append(base);
    const frame = document.createElement("iframe");
    frame.src = "/privacy";
    frame.title = "CSP test frame";
    document.body.append(frame);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            document.documentElement.dataset.cspViolations ?? "[]",
          ) as string[],
      ),
    )
    .toEqual(
      expect.arrayContaining(["script-src-attr", "frame-src", "base-uri"]),
    );
  expect(
    await page.evaluate(() => document.documentElement.dataset.inlineExecuted),
  ).toBeUndefined();
  expect(await page.evaluate(() => document.baseURI)).toBe(originalBase);
});
test("known costs, task edits and schedule edits expose focused field errors to assistive technology", async ({
  page,
}) => {
  await saved(page);
  const scenario = page.locator("#what-if"),
    cost = scenario.getByLabel("Minimum known cost", { exact: true });
  await cost.fill("0");
  const set = scenario.getByRole("button", { name: "Set category minimum" });
  await set.focus();
  await page.keyboard.press("Enter");
  await expect(cost).toBeFocused();
  await expect(cost).toHaveAttribute("aria-invalid", "true");
  await expect(cost).toHaveAccessibleDescription(/positive INR amount/);
  await axe(page);
  await cost.fill("100");
  await set.click();
  await expect(cost).toHaveAttribute("aria-invalid", "false");
  await page
    .getByRole("button", { name: "Review suggested next task" })
    .click();
  const title = page.getByLabel("Task title", { exact: true });
  await title.fill("");
  await page
    .getByRole("button", { name: "Review task change", exact: true })
    .click();
  await expect(title).toBeFocused();
  await expect(title).toHaveAccessibleDescription(/Too small/);
  await axe(page);
  const schedule = page.locator("#day-of");
  await schedule.locator(":scope > summary").click();
  await schedule
    .getByRole("button", { name: "Load sample day-of schedule" })
    .click();
  const duration = schedule.getByLabel("Activity 1 duration (minutes)", {
    exact: true,
  });
  await duration.fill("0");
  await schedule
    .getByRole("button", { name: "Save day-of schedule", exact: true })
    .click();
  await expect(duration).toBeFocused();
  await expect(duration).toHaveAttribute("aria-invalid", "true");
  await expect(duration).toHaveAccessibleDescription(/Too small/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await axe(page);
});
test("failed reload confirmation stays open, describes failure and restores focus after cancellation", async ({
  page,
}) => {
  await saved(page);
  const id = page.url().split("/").at(-1);
  await page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("eventgenie-local-v1", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Test database unavailable"));
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        ["plans", "events", "enhancements", "history"],
        "readwrite",
      );
      for (const name of ["plans", "events", "enhancements", "history"])
        transaction.objectStore(name).delete(id ?? "");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("Test deletion failed"));
    });
    database.close();
  }, id);
  const trigger = page.getByRole("button", {
    name: "Reload saved version",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleDescription(/latest saved/i);
  await dialog
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("could not be applied");
  await expect(dialog).toHaveAccessibleDescription(
    /original saved data is preserved/,
  );
  await axe(page);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(trigger).toBeFocused();
});
test("initial planner JavaScript stays within five percent of the audited baseline", async ({
  request,
}, testInfo) => {
  const html = await (await request.get("/plan")).text();
  const scripts = [
    ...new Set(
      [...html.matchAll(/<script[^>]+src="([^"]+\.js(?:\?[^"]*)?)"/g)].map(
        (match) => match[1].replaceAll("&amp;", "&"),
      ),
    ),
  ];
  expect(scripts.length).toBeGreaterThan(0);
  const sizes = await Promise.all(
    scripts.map(
      async (url) => gzipSync(await (await request.get(url)).body()).byteLength,
    ),
  );
  const gzipBytes = sizes.reduce((sum, size) => sum + size, 0),
    baselineBytes = 246681;
  await testInfo.attach("initial-planner-js.json", {
    body: JSON.stringify({
      baselineBytes,
      gzipBytes,
      scripts: scripts.length,
      changePercent: 100 * (gzipBytes / baselineBytes - 1),
    }),
    contentType: "application/json",
  });
  expect(gzipBytes).toBeLessThanOrEqual(Math.floor(baselineBytes * 1.05));
});

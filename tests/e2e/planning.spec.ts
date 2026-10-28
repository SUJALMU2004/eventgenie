import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoEvent, demoRecommendations } from "../../src/data/demo";
import {
  eventTypes,
  generationInputSchema,
  type EventType,
} from "../../src/schemas/event";
import { normalizePlan } from "../../src/lib/normalize";
import { inputFingerprint } from "../../src/lib/fingerprint";
import { addDays, today } from "../../src/lib/dates";

async function mockGeneration(page: Page) {
  let requests = 0;
  await page.route("**/api/plans/generate", async (route) => {
    requests++;
    const event = generationInputSchema().parse(route.request().postDataJSON());
    const recommendations = demoRecommendations(event);
    const plan = normalizePlan(
      event,
      recommendations,
      await inputFingerprint(event),
      "ai",
    );
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          JSON.stringify({
            type: "preview",
            data: { overview: recommendations.overview },
          }),
          JSON.stringify({ type: "complete", data: plan }),
        ].join("\n") + "\n",
    });
  });
  return () => requests;
}
async function setup(
  page: Page,
  type: EventType,
  title = `Our ${type} celebration`,
) {
  await page.goto(`/plan?type=${type}`);
  await page.getByLabel("Event title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Event date", { exact: true })
    .fill(addDays(today(), 120));
  await page.getByLabel("City or location").fill("Hubballi");
  await page
    .getByLabel("Expected guests", { exact: true })
    .fill(type === "wedding" ? "250" : "40");
  await page
    .getByLabel("Total available budget", { exact: true })
    .fill(type === "wedding" ? "500000" : "40000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Style or theme (optional)")
    .fill("Traditional and thoughtful");
  await page.getByLabel("Food preferences (optional)").fill("Vegetarian");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

for (const type of eventTypes)
  test(`${type}: wizard → mocked AI plan → persistence → reopen`, async ({
    page,
  }) => {
    const requests = await mockGeneration(page);
    await setup(page, type);
    await expect(
      page.getByRole("heading", { name: "One last look before the magic." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Generate my event plan" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `Our ${type} celebration`,
    );
    await expect(
      page.getByText("Sample plan · deterministic demo data"),
    ).toHaveCount(0);
    const checkbox = page.getByRole("checkbox").first();
    const taskName = await checkbox.getAttribute("id");
    await checkbox.check();
    await expect(
      page.getByText("Checklist progress saved in this browser."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Open saved copy" }).click();
    await page.waitForURL(/\/plans\/[a-f0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `Our ${type} celebration`,
    );
    await page.reload();
    await expect(page.locator(`[id="${taskName}"]`)).toBeChecked();
    await expect(
      page.getByRole("table", {
        name: "Planned budget allocations, including contingency",
      }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    if (type === "wedding")
      await page.screenshot({
        path: "artifacts/dashboard-desktop.png",
        fullPage: true,
      });
    // Re-entering identical requirements reopens the local AI result instead of consuming tokens.
    await setup(page, type);
    await page.getByRole("button", { name: "Generate my event plan" }).click();
    await expect(
      page.getByText(
        "Reopened your existing AI plan. No new AI request was made.",
      ),
    ).toBeVisible();
    expect(requests()).toBe(1);
  });

test("landing, wizard and library pass automated accessibility checks", async ({
  page,
}) => {
  for (const url of ["/", "/plan?type=birthday", "/plans", "/privacy"]) {
    await page.goto(url);
    if (url.startsWith("/plan?"))
      await expect(
        page.getByLabel("Event title", { exact: true }),
      ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations, url).toEqual([]);
    if (url === "/")
      await page.screenshot({
        path: "artifacts/landing-desktop.png",
        fullPage: true,
      });
  }
});

test("invalid form focuses its labelled error and drafts survive refresh", async ({
  page,
}) => {
  await page.goto("/plan?type=birthday");
  await page.getByRole("button", { name: "Continue" }).click();
  const title = page.getByLabel("Event title", { exact: true });
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toBeFocused();
  await title.fill("A birthday worth remembering");
  // The repository is eventually updated by the debounced local draft writer.
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          new Promise<string>((resolve, reject) => {
            const request = indexedDB.open("eventgenie-local-v1");
            request.onsuccess = () => {
              const read = request.result
                .transaction("drafts")
                .objectStore("drafts")
                .get("current");
              read.onsuccess = () => {
                resolve(read.result?.data?.title ?? "");
                request.result.close();
              };
              read.onerror = reject;
            };
            request.onerror = reject;
          }),
      ),
    )
    .toBe("A birthday worth remembering");
  await page.reload();
  await expect(title).toHaveValue("A birthday worth remembering");
});

test("keyboard-only wizard navigation and mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/plan?type=birthday");
  await expect(page.getByLabel("Event title", { exact: true })).toBeVisible();
  // Reach, edit and submit the form entirely through the keyboard.
  for (let index = 0; index < 35; index++) {
    if (
      await page
        .getByLabel("Event title", { exact: true })
        .evaluate((element) => element === document.activeElement)
    )
      break;
    await page.keyboard.press("Tab");
  }
  await expect(page.getByLabel("Event title", { exact: true })).toBeFocused();
  await page.keyboard.type("Keyboard birthday");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Let’s get the essentials right." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/wizard-mobile.png",
    fullPage: true,
  });
});

test("provider quota errors preserve details and offer an explicit demo", async ({
  page,
}) => {
  await page.route("**/api/plans/generate", (route) =>
    route.fulfill({
      status: 429,
      contentType: "text/html",
      body: "Rate limit exceeded",
    }),
  );
  await setup(page, "birthday");
  await page.getByRole("button", { name: "Generate my event plan" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Too many requests",
  );
  await expect(
    page.getByText("Our birthday celebration", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create sample plan · no AI call" })
    .click();
  await expect(
    page.getByText("Sample plan · deterministic demo data"),
  ).toBeVisible();
});

test("sample plan can be deleted with keyboard-accessible confirmation", async ({
  page,
}) => {
  await page.goto("/plan?demo=community");
  for (let index = 0; index < 3; index++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create sample plan · no AI call" })
    .click();
  await expect(
    page.getByText("Sample plan · deterministic demo data"),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "My plans", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /Delete Our neighbourhood/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: /Delete Our neighbourhood/ }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByRole("heading", { name: "Your next happy moment belongs here." }),
  ).toBeVisible();
});

test("production endpoint handles missing configuration without exposing internals", async ({
  request,
}) => {
  const response = await request.post("/api/plans/generate", { data: {} });
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: "INVALID_INPUT" },
  });
  const unconfigured = await request.post("/api/plans/generate", {
    data: demoEvent("wedding"),
  });
  expect(unconfigured.status()).toBe(503);
  expect(unconfigured.headers()["content-security-policy"]).not.toContain(
    "unsafe-eval",
  );
  expect(await unconfigured.json()).toMatchObject({
    error: { code: "MISSING_CONFIGURATION" },
  });
});

test("AI endpoints accept each loopback browser origin", async ({
  page,
  baseURL,
}) => {
  for (const hostname of ["localhost", "127.0.0.1"]) {
    const url = new URL(baseURL!);
    url.hostname = hostname;
    await page.goto(url.href);
    const responses = await page.evaluate(async () => {
      const results = [];
      for (const path of ["generate", "enhance", "intelligence"]) {
        // Deliberately invalid input tests the real origin boundary without an AI call.
        const response = await fetch(`/api/plans/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        results.push({ status: response.status, body: await response.json() });
      }
      return results;
    });
    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_INPUT");
    }
  }
});

test("cancelling generation preserves the review and can be retried", async ({
  page,
}) => {
  await page.route("**/api/plans/generate", () => {
    /* Hold the mocked network response until the client cancels it. */
  });
  await setup(page, "birthday");
  await page.getByRole("button", { name: "Generate my event plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Your celebration is taking shape." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel generation" }).click();
  await expect(
    page.getByRole("heading", { name: "One last look before the magic." }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "cancelled",
  );
  await expect(
    page.getByText("Our birthday celebration", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate my event plan" }),
  ).toBeEnabled();
});

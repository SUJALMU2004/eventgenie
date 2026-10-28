import { test, expect, type Page } from "@playwright/test";
test.describe.configure({ timeout: 90000 });
import AxeBuilder from "@axe-core/playwright";
import { eventTypes, type EventType } from "../../src/schemas/event";
import {
  validateIntelligenceRequest,
  offlineIntelligence,
} from "../../src/lib/ai/intelligence";
async function create(page: Page, type: EventType = "wedding") {
  await page.goto(`/plan?demo=${type}`);
  for (let n = 0; n < 3; n++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create sample plan · no AI call" })
    .click();
  await page.getByRole("link", { name: "Open saved copy" }).click();
  await page.waitForURL(/\/plans\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: "Your Decision Studio." }),
  ).toBeVisible();
}
async function advanced(page: Page) {
  await page
    .getByRole("button", { name: "Open advanced planning", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your next best steps", exact: true }),
  ).toBeVisible();
}
async function open(page: Page, id: string) {
  const section = page.locator(`#${id}`);
  if ((await section.getAttribute("open")) === null)
    await section.locator(":scope > summary").click();
  return section;
}
async function confirm(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
for (const type of eventTypes)
  test(`${type}: reversible decisions, contingency, assistant, invitation and refresh`, async ({
    page,
  }) => {
    await create(page, type);
    await advanced(page);
    const originalBudget = await page
      .locator(".stats-grid > div")
      .first()
      .locator("strong")
      .textContent();
    const actions = page.locator("#next-actions");
    await actions
      .getByRole("button", { name: "Review suggested next task" })
      .click();
    await actions
      .getByLabel("Task title", { exact: true })
      .fill(`Reviewed ${type} backup`);
    await actions
      .getByRole("button", { name: "Review task change", exact: true })
      .click();
    await confirm(page);
    const task = page.getByRole("checkbox", {
      name: `Reviewed ${type} backup`,
      exact: true,
    });
    await expect(task).toBeVisible();
    const taskId = await task.getAttribute("id");
    await task.check();
    await expect(task).toBeChecked();
    await page.getByRole("button", { name: "Undo last change" }).click();
    await confirm(page);
    await expect(task).not.toBeChecked();
    await page.getByRole("button", { name: "Redo last change" }).click();
    await confirm(page);
    await expect(task).toBeChecked();
    const whatIf = page.locator("#what-if");
    await whatIf
      .getByRole("button", { name: "Budget −15%", exact: true })
      .click();
    await whatIf.getByLabel("Scenario name").fill("Simpler celebration");
    await whatIf
      .getByRole("button", { name: "Save scenario", exact: true })
      .click();
    await expect(whatIf.getByText(/Simpler celebration ·/)).toBeVisible();
    await whatIf
      .getByRole("button", { name: "15% reserve", exact: true })
      .click();
    await whatIf.getByLabel("Scenario name").fill("More breathing room");
    await whatIf
      .getByRole("button", { name: "Save scenario", exact: true })
      .click();
    const compare = await open(page, "compare-strategies");
    await compare
      .getByRole("checkbox", { name: "Simpler celebration", exact: true })
      .check();
    await compare
      .getByRole("checkbox", { name: "More breathing room", exact: true })
      .check();
    await expect(
      compare
        .getByRole("table", { name: "Planning strategy comparison" })
        .getByRole("columnheader"),
    ).toHaveCount(4);
    await compare
      .getByRole("button", { name: "Apply Simpler celebration", exact: true })
      .click();
    await confirm(page);
    await expect(
      page.locator(".stats-grid > div").first().locator("strong"),
    ).not.toHaveText(originalBudget!);
    await page.getByRole("button", { name: "Undo last change" }).click();
    await confirm(page);
    await expect(
      page.locator(".stats-grid > div").first().locator("strong"),
    ).toHaveText(originalBudget!);
    const contingency = await open(page, "contingency-planner");
    await contingency
      .getByRole("button", { name: "Analyze contingency impact" })
      .click();
    await expect(
      contingency.getByRole("heading", { name: "Before → proposed change" }),
    ).toBeVisible();
    await contingency
      .getByRole("checkbox", {
        name: /Add priority task: Review rain contingency/,
      })
      .check();
    await contingency
      .getByRole("button", { name: "Review selected contingency changes" })
      .click();
    await confirm(page);
    await expect(
      page.getByRole("checkbox", {
        name: "Review rain contingency",
        exact: true,
      }),
    ).toBeVisible();
    const ask = await open(page, "ask-eventgenie");
    let requests = 0;
    await page.route("**/api/plans/intelligence", (route) => {
      requests++;
      return route.abort();
    });
    await ask
      .getByRole("button", { name: "How much budget remains?", exact: true })
      .click();
    await expect(
      ask.getByText(
        "This exact financial question is answered locally. No AI request is needed.",
      ),
    ).toBeVisible();
    expect(requests).toBe(0);
    await ask
      .getByRole("button", {
        name: "What should I finish this week?",
        exact: true,
      })
      .click();
    await ask
      .getByRole("button", { name: "Preview sample plan answer", exact: true })
      .click();
    await expect(
      ask.getByRole("heading", { name: "AI-generated ideas and explanation" }),
    ).toBeVisible();
    await ask
      .getByRole("button", { name: "Keep answer in this event" })
      .click();
    const invitations = await open(page, "invitation-studio");
    await invitations
      .getByRole("combobox", { name: "Invitation tone", exact: true })
      .selectOption("friendly");
    await invitations
      .getByRole("combobox", { name: "Invitation length", exact: true })
      .selectOption("detailed");
    await invitations
      .getByRole("button", { name: "Preview local tone template" })
      .click();
    await invitations
      .getByLabel("Verified event time (optional)")
      .fill("18:00 IST");
    await invitations
      .getByLabel("Verified venue details (optional)")
      .fill("Fictional sample hall");
    await invitations
      .getByLabel("Your RSVP instructions (optional)")
      .fill("Reply to the organiser");
    await invitations
      .getByRole("button", { name: "Review invitation changes", exact: true })
      .click();
    await confirm(page);
    await expect(page.locator(".invitation-card p").first()).toContainText(
      "Fictional sample hall",
    );
    await expect(task).toBeChecked();
    const download = page.waitForEvent("download");
    await invitations
      .getByRole("button", { name: "Download invitation text" })
      .click();
    expect((await download).suggestedFilename()).toContain("invitation.txt");
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => undefined },
      }),
    );
    await invitations
      .getByRole("button", { name: "Copy full invitation" })
      .click();
    await expect(
      invitations.getByRole("status").filter({ hasText: "Invitation copied." }),
    ).toBeVisible();
    await page.reload();
    await advanced(page);
    await expect(
      page.getByRole("checkbox", {
        name: `Reviewed ${type} backup`,
        exact: true,
      }),
    ).toBeChecked();
    expect(
      await page
        .getByRole("checkbox", { name: `Reviewed ${type} backup`, exact: true })
        .getAttribute("id"),
    ).toBe(taskId);
    await open(page, "invitation-studio");
    await expect(
      page
        .locator("#invitation-studio")
        .getByRole("textbox", { name: "Full invitation preview", exact: true }),
    ).toHaveValue(/Fictional sample hall/);
    await expect(
      page.getByRole("button", { name: "Undo last change" }),
    ).toBeEnabled();
    await page
      .locator(".intelligence-hub details")
      .evaluateAll((elements) =>
        elements.forEach((element) => element.setAttribute("open", "")),
      );
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(report.violations).toEqual([]);
  });
test("stale tabs cannot overwrite newer changes and can reload safely", async ({
  page,
  context,
}) => {
  await create(page);
  const url = page.url(),
    other = await context.newPage();
  await other.goto(url);
  await expect(
    other.getByRole("heading", { name: "Your Decision Studio." }),
  ).toBeVisible();
  const first = page.locator(".task-list input[type=checkbox]").first();
  await first.check();
  await expect(first).toBeChecked();
  const second = other.locator(".task-list input[type=checkbox]").nth(1);
  await second.click();
  await expect(
    other.getByRole("status").filter({ hasText: /Another tab changed/ }),
  ).toBeVisible();
  await expect(second).not.toBeChecked();
  await other.getByRole("button", { name: "Reload saved version" }).click();
  await confirm(other);
  await expect(
    other.locator(".task-list input[type=checkbox]").first(),
  ).toBeChecked();
  await second.check();
  await expect(second).toBeChecked();
  await other.close();
});
test("AI answers are minimized, cacheable, cancellable and reject invented references", async ({
  page,
}) => {
  await create(page, "birthday");
  await advanced(page);
  const ask = await open(page, "ask-eventgenie");
  let calls = 0,
    invalid = false;
  await page.route("**/api/plans/intelligence", async (route) => {
    calls++;
    const input = validateIntelligenceRequest(route.request().postDataJSON());
    expect(JSON.stringify(input)).not.toContain("Meera");
    expect(JSON.stringify(input)).not.toContain("@example");
    const output = offlineIntelligence(input);
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          version: 3,
          type: "complete",
          data: invalid ? { ...output, references: ["task-99"] } : output,
        }) + "\n",
    });
  });
  await ask
    .getByRole("button", { name: "Generate plan answer with AI", exact: true })
    .click();
  await expect(
    ask.getByText("AI preview · not applied", { exact: true }),
  ).toBeVisible();
  await ask.getByRole("button", { name: "Reject plan answer preview" }).click();
  await ask
    .getByRole("button", { name: "Generate plan answer with AI", exact: true })
    .click();
  await expect(
    ask.getByText("Cached AI preview · not applied", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await ask
    .getByLabel("Your plan-specific question")
    .fill("Which tasks should I review next?");
  await expect(
    ask.getByRole("button", { name: "Keep answer in this event" }),
  ).toBeDisabled();
  await ask.getByRole("button", { name: "Reject plan answer preview" }).click();
  invalid = true;
  await ask
    .getByLabel("Your plan-specific question")
    .fill("Which tasks are urgent?");
  await ask
    .getByRole("button", { name: "Generate plan answer with AI", exact: true })
    .click();
  await expect(ask.getByRole("alert")).toContainText("outside this plan");
  await page.unroute("**/api/plans/intelligence");
  await page.route("**/api/plans/intelligence", () => {});
  await ask
    .getByLabel("Your plan-specific question")
    .fill("How can I simplify this birthday?");
  await ask
    .getByRole("button", { name: "Generate plan answer with AI", exact: true })
    .click();
  await ask.getByRole("button", { name: "Cancel plan answer" }).click();
  await expect(ask.getByRole("status")).toContainText("Cancelled");
  await expect(ask.getByLabel("Your plan-specific question")).toHaveValue(
    "How can I simplify this birthday?",
  );
});
test("mobile keyboard, disclosure, clipboard/share fallbacks and draft preservation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await create(page, "community");
  await advanced(page);
  const invitations = await open(page, "invitation-studio");
  await invitations
    .getByRole("textbox", { name: "Invitation message", exact: true })
    .fill("My carefully edited message");
  await page.getByRole("button", { name: "Close advanced planning" }).click();
  await page.getByRole("button", { name: "Open advanced planning" }).click();
  await expect(
    invitations.getByRole("textbox", {
      name: "Invitation message",
      exact: true,
    }),
  ).toHaveValue("My carefully edited message");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
  });
  await invitations
    .getByRole("button", { name: "Copy full invitation" })
    .click();
  await expect(
    invitations
      .getByRole("status")
      .filter({ hasText: "Clipboard unavailable" }),
  ).toBeVisible();
  await expect(
    invitations.getByRole("textbox", {
      name: "Full invitation preview",
      exact: true,
    }),
  ).toBeFocused();
  await invitations
    .getByRole("button", { name: "Share invitation", exact: true })
    .click();
  await expect(
    invitations
      .getByRole("status")
      .filter({ hasText: "Native sharing unavailable" }),
  ).toBeVisible();
  await page.locator("#ask-eventgenie > summary").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator("#ask-eventgenie").getByLabel("Your plan-specific question"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await invitations.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/intelligence-mobile.png" });
});

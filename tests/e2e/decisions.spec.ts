import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eventTypes, type EventType } from "../../src/schemas/event";
import {
  validateOperationRequest,
  offlineOperation,
  operationPreview,
} from "../../src/lib/ai/operations";
import { parseBackup } from "../../src/lib/portability";
async function createEvent(page: Page, type: EventType = "wedding") {
  await page.goto(`/plan?demo=${type}`);
  for (let step = 0; step < 3; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create sample plan · no AI call" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your Decision Studio." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open saved copy" }).click();
  await page.waitForURL(/\/plans\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("heading", { name: "Your Decision Studio." }),
  ).toBeVisible();
}
async function openSection(page: Page, id: string) {
  await page
    .locator(`#${id}`)
    .evaluate((element) => element.setAttribute("open", ""));
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function mockOperations(page: Page) {
  let requests = 0;
  await page.route("**/api/plans/enhance", async (route) => {
    requests++;
    const input = validateOperationRequest(route.request().postDataJSON());
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          version: 2,
          type: "preview",
          data: operationPreview(
            input,
            input.operation === "rescue-ideas" ? { recommendations: [] } : {},
          ) ?? { kind: "ideas", itemsReceived: 1 },
        }) +
        "\n" +
        JSON.stringify({
          version: 2,
          type: "complete",
          data: offlineOperation(input),
        }) +
        "\n",
    });
  });
  return () => requests;
}
for (const type of eventTypes)
  test(`${type}: reviewed financial decisions, vendor booking, schedule and restore`, async ({
    page,
  }) => {
    await createEvent(page, type);
    const originalTitle = await page
      .getByRole("heading", { level: 1 })
      .textContent();
    const scenario = page.locator("#what-if");
    const originalBudget = await scenario
      .getByLabel("Scenario budget", { exact: true })
      .inputValue();
    await scenario.getByRole("button", { name: "Budget −15%" }).click();
    await expect(
      scenario.getByRole("table", {
        name: "Original versus simulated allocations",
      }),
    ).toBeVisible();
    await scenario.getByLabel("Scenario name").fill("A careful budget");
    await scenario
      .getByRole("button", { name: "Save scenario", exact: true })
      .click();
    await expect(scenario.getByText(/A careful budget ·/)).toBeVisible();
    await scenario
      .getByRole("button", { name: "Apply Scenario", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Completed tasks");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await scenario.getByRole("button", { name: "Reset scenario" }).click();
    await expect(
      scenario.getByLabel("Scenario budget", { exact: true }),
    ).toHaveValue(originalBudget);
    await scenario.getByRole("button", { name: "Budget −15%" }).click();
    await scenario
      .getByRole("button", { name: "Apply Scenario", exact: true })
      .click();
    await confirm(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      originalTitle!,
    );
    await openSection(page, "vendor-desk");
    const vendors = page.locator("#vendor-desk");
    await vendors
      .getByRole("button", { name: "Add vendor", exact: true })
      .click();
    await vendors.getByLabel("Vendor display name").fill("My local option");
    await vendors.getByLabel(/Quoted price/).fill("1000");
    await vendors
      .getByRole("combobox", { name: "Availability", exact: true })
      .selectOption("available");
    await vendors.getByLabel("Booking status").selectOption("booked");
    await vendors.getByRole("button", { name: "Save vendor quote" }).click();
    await confirm(page);
    await expect(vendors.getByRole("table")).toContainText("booked");
    await expect(vendors.getByRole("table")).toContainText("My local option");
    await openSection(page, "budget-rescue");
    const rescue = page.locator("#budget-rescue");
    await rescue.getByLabel("Payment label").fill("Vendor deposit");
    await rescue.getByLabel(/Amount actually paid/).fill("200");
    await rescue
      .getByLabel("Link payment to vendor")
      .selectOption({ label: "My local option" });
    await rescue.getByRole("button", { name: "Record payment" }).click();
    await expect(rescue.getByText(/Vendor deposit ·/)).toBeVisible();
    await openSection(page, "day-of");
    const schedule = page.locator("#day-of");
    await schedule
      .getByRole("button", { name: "Load sample day-of schedule" })
      .click();
    await schedule
      .getByLabel("Activity 1 title", { exact: true })
      .fill("My carefully prepared setup");
    await schedule
      .getByRole("button", { name: "Save day-of schedule", exact: true })
      .click();
    await confirm(page);
    await expect(
      schedule.getByRole("table", { name: "Saved event-day activities" }),
    ).toContainText("My carefully prepared setup");
    await page.reload();
    await openSection(page, "vendor-desk");
    await expect(page.locator("#vendor-desk").getByRole("table")).toContainText(
      "My local option",
    );
    await openSection(page, "day-of");
    await expect(page.locator("#day-of").getByRole("table")).toContainText(
      "My carefully prepared setup",
    );
    await expect(page.locator("#readiness")).toContainText(
      "RULE_VENDOR_NOT_BOOKED",
    );
    await page
      .locator("#day-of details.ai-operation")
      .evaluate((element) => element.setAttribute("open", ""));
    const issues = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(issues.violations).toEqual([]);
  });
test("targeted AI preview is reviewed, rejected, cached, then explicitly accepted", async ({
  page,
}) => {
  const count = await mockOperations(page);
  await createEvent(page, "birthday");
  await openSection(page, "refinement");
  const refinement = page.locator("#refinement");
  await refinement
    .getByLabel("Refinement action")
    .selectOption("formal-invitation");
  const original = await page
    .locator("#main .invitation-card p")
    .first()
    .textContent();
  await refinement
    .getByRole("button", { name: "Generate refinement preview" })
    .click();
  await expect(refinement.getByText(/AI preview.*not applied/)).toBeVisible();
  await expect(page.locator("#main .invitation-card p").first()).toHaveText(
    original!,
  );
  await refinement.getByRole("button", { name: "Reject preview" }).click();
  await expect(page.locator("#main .invitation-card p").first()).toHaveText(
    original!,
  );
  await refinement
    .getByRole("button", { name: "Generate refinement preview" })
    .click();
  await expect(refinement.getByText(/Cached AI preview/)).toBeVisible();
  expect(count()).toBe(1);
  await refinement
    .getByRole("button", { name: "Accept proposed invitations" })
    .click();
  await confirm(page);
  await expect(page.locator("#main .invitation-card p").first()).toContainText(
    "cordially invited",
  );
  await expect(
    page.locator("#main .invitation-card p").first(),
  ).not.toContainText("[event title]");
  await page.reload();
  await expect(page.locator("#main .invitation-card p").first()).toContainText(
    "cordially invited",
  );
});
test("private JSON backup restore and safe all-day calendar download", async ({
  page,
}) => {
  await createEvent(page, "community");
  await page
    .getByRole("button", { name: "Load fictional Phase 2 examples" })
    .click();
  await confirm(page);
  await openSection(page, "export");
  const section = page.locator("#export");
  const backupDownload = page.waitForEvent("download");
  await section.getByRole("button", { name: "Download JSON backup" }).click();
  const backup = await backupDownload,
    stream = await backup.createReadStream();
  if (!stream) throw new Error("No backup stream");
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  const original = parseBackup(text),
    originalId = original.plan.id;
  await section.getByLabel("Restore a JSON backup").setInputFiles({
    name: "private-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(
    section.getByRole("heading", { name: "Review backup before importing" }),
  ).toBeVisible();
  await section.getByRole("button", { name: "Import as a new plan" }).click();
  await confirm(page);
  await section.getByRole("link", { name: "Open restored plan" }).click();
  await page.waitForURL(/\/plans\/[a-f0-9-]+$/);
  await expect(page).not.toHaveURL(new RegExp(originalId));
  await openSection(page, "vendor-desk");
  await expect(page.locator("#vendor-desk")).toContainText(
    "Sample option A — fictional",
  );
  await openSection(page, "export");
  const calendarDownload = page.waitForEvent("download");
  await page
    .locator("#export")
    .getByRole("button", { name: "Download calendar" })
    .click();
  const calendar = await calendarDownload,
    calendarStream = await calendar.createReadStream();
  let encoded = "";
  if (calendarStream)
    for await (const chunk of calendarStream) encoded += chunk.toString();
  expect(encoded).toContain("BEGIN:VCALENDAR\r\n");
  expect(encoded).toContain("DTSTART;VALUE=DATE:");
});
test("dependency cycles, schedule conflicts and Gemini failure preserve work", async ({
  page,
}) => {
  await createEvent(page);
  const readiness = page.locator("#readiness");
  await readiness.getByText("Edit task dependencies", { exact: true }).click();
  await readiness.getByLabel("Prerequisite task").selectOption({ index: 0 });
  await readiness.getByRole("button", { name: "Add dependency" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "cannot depend on itself" }),
  ).toBeVisible();
  await openSection(page, "day-of");
  const schedule = page.locator("#day-of");
  await schedule
    .getByRole("button", { name: "Load sample day-of schedule" })
    .click();
  await schedule.getByLabel("Activity 2 start", { exact: true }).fill("09:00");
  await schedule
    .getByRole("button", { name: "Save day-of schedule", exact: true })
    .click();
  await confirm(page);
  await expect(schedule.getByRole("alert")).toContainText("overlaps");
  await openSection(page, "refinement");
  const refine = page.locator("#refinement");
  await refine
    .getByRole("button", { name: "Generate refinement preview" })
    .click();
  await expect(refine.getByRole("alert")).toContainText("not configured");
  await refine
    .getByRole("button", { name: "Preview sample refinement" })
    .click();
  await expect(refine.getByText(/Deterministic sample preview/)).toBeVisible();
});
test("mobile keyboard access and print layout expose saved schedule without controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createEvent(page, "birthday");
  await page.locator("#vendor-desk > summary").focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .locator("#vendor-desk")
      .getByRole("button", { name: "Add vendor", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load fictional Phase 2 examples" })
    .click();
  await confirm(page);
  await openSection(page, "day-of");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/phase2-mobile.png",
    fullPage: true,
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#day-of .schedule-summary")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Event decision sections" }),
  ).not.toBeVisible();
  await expect(
    page
      .locator("#day-of")
      .getByRole("button", { name: "Save day-of schedule", exact: true }),
  ).not.toBeVisible();
});
test("restricted IndexedDB keeps a sample plan and decisions usable in the tab", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        return undefined;
      },
      configurable: true,
    }),
  );
  await page.goto("/plan?demo=birthday");
  for (let step = 0; step < 3; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create sample plan · no AI call" })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry saving this plan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your Decision Studio." }),
  ).toBeVisible();
  await page
    .locator("#what-if")
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(
    page.getByText(
      "Changes are kept in this tab but could not be saved. Keep the tab open and retry saving.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry saving decisions" }),
  ).toBeVisible();
});

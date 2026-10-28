import { describe, expect, it } from "vitest";
import {
  createBackup,
  parseBackup,
  cloneImportedWorkspace,
  createCalendar,
  escapeCalendarText,
  foldCalendarLine,
  MAX_BACKUP_BYTES,
} from "./portability";
import { emptyEnhancements } from "@/schemas/enhancements";
import { clock, plan } from "@/test/fixtures";
import { exampleSchedule } from "./planning/schedule";
import { scenarioDefaults } from "./planning/finance";
describe("selected-plan backups", () => {
  it("round-trips decisions and remaps every owned reference", () => {
    const state = emptyEnhancements(plan.id),
      quoteId = crypto.randomUUID();
    state.quotes.push({
      id: quoteId,
      planId: plan.id,
      category: "venue",
      displayName: "My option",
      quotedMinor: 1000,
      commitmentMinor: 1000,
      booking: "booked",
      quoteStatus: "written",
      availability: "unknown",
      notes: "Private",
      inclusions: [],
      contact: "private@example.com",
      source: "user",
    });
    state.expenses.push({
      id: crypto.randomUUID(),
      planId: plan.id,
      category: "venue",
      label: "Deposit",
      amountMinor: 100,
      vendorQuoteId: quoteId,
    });
    state.scenarios.push({
      id: crypto.randomUUID(),
      planId: plan.id,
      name: "Preview",
      input: scenarioDefaults(plan),
      createdAt: clock().toISOString(),
    });
    state.dependencies.push({
      taskId: plan.tasks[1].id,
      dependsOn: [plan.tasks[0].id],
    });
    state.schedule = exampleSchedule("wedding", {
      startMinute: 540,
      endMinute: 1020,
      timeZone: "UTC",
    });
    state.schedule.activities[0].taskId = plan.tasks[0].id;
    const workspace = { plan, enhancements: state };
    expect(parseBackup(createBackup(workspace, clock))).toEqual(workspace);
    const clone = cloneImportedWorkspace(workspace, clock);
    expect(clone.plan.id).not.toBe(plan.id);
    expect(clone.enhancements.planId).toBe(clone.plan.id);
    expect(clone.enhancements.expenses[0].vendorQuoteId).toBe(
      clone.enhancements.quotes[0].id,
    );
    expect(clone.enhancements.dependencies[0].taskId).toBe(
      clone.plan.tasks[1].id,
    );
    expect(clone.enhancements.schedule?.activities[0].taskId).toBe(
      clone.plan.tasks[0].id,
    );
    expect(clone.enhancements.scenarios[0].planId).toBe(clone.plan.id);
    expect(clone.enhancements.quotes[0].contact).toBe("private@example.com");
    expect(clone.enhancements.importedAt).toBe(clock().toISOString());
  });
  it("migrates a version-1 backup", () => {
    expect(
      parseBackup(
        JSON.stringify({
          backupVersion: 1,
          exportedAt: clock().toISOString(),
          plan,
        }),
      ).enhancements,
    ).toEqual(emptyEnhancements(plan.id));
  });
  it.each([
    "bad JSON",
    "{}",
    '{"backupVersion":99}',
    '{"__proto__":{"polluted":true}}',
    '{"constructor":{}}',
    '{"prototype":{}}',
  ])("rejects malicious or malformed data", (text) =>
    expect(() => parseBackup(text)).toThrow(),
  );
  it("rejects oversized content", () => {
    expect(() => parseBackup("a".repeat(MAX_BACKUP_BYTES + 1))).toThrow(
      "2 MiB",
    );
  });
  it("keeps HTML strings inert", () => {
    const malicious = {
      ...plan,
      event: { ...plan.event, title: '<img src=x onerror="alert(1)">' },
    };
    expect(
      parseBackup(
        createBackup({
          plan: malicious,
          enhancements: emptyEnhancements(plan.id),
        }),
      ).plan.event.title,
    ).toContain("<img");
  });
  it("rejects duplicate IDs and missing references", () => {
    const payload = JSON.parse(
      createBackup({ plan, enhancements: emptyEnhancements(plan.id) }),
    );
    payload.plan.tasks[1].id = payload.plan.tasks[0].id;
    expect(() => parseBackup(JSON.stringify(payload))).toThrow();
    payload.plan = plan;
    payload.enhancements.expenses = [
      {
        id: crypto.randomUUID(),
        planId: plan.id,
        category: "venue",
        label: "Broken link",
        amountMinor: 1,
        vendorQuoteId: crypto.randomUUID(),
      },
    ];
    expect(() => parseBackup(JSON.stringify(payload))).toThrow();
  });
  it("clones a record without a schedule", () => {
    const clone = cloneImportedWorkspace({
      plan,
      enhancements: emptyEnhancements(plan.id),
    });
    expect(clone.enhancements.schedule).toBeUndefined();
    expect(clone.enhancements.cache).toEqual([]);
  });
});
describe("RFC 5545 calendar encoding", () => {
  it("handles malformed Unicode in untrusted opaque IDs without throwing", () => {
    const malformed = {
      ...plan,
      tasks: plan.tasks.map((task, index) =>
        index === 0 ? { ...task, id: "\ud800" } : task,
      ),
    };
    expect(createCalendar(malformed)).toContain(
      "UID:utf16-d800@eventgenie.local",
    );
  });
  it("writes CRLF, exclusive end dates and optional milestones", () => {
    const calendar = createCalendar(plan, false, clock);
    expect(calendar).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(calendar).toContain("DTSTART;VALUE=DATE:20270223");
    expect(calendar).toContain("DTEND;VALUE=DATE:20270224");
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(
      createCalendar(plan, true, clock).match(/BEGIN:VEVENT/g),
    ).toHaveLength(16);
    expect(createCalendar(plan)).toContain("DTSTAMP:");
  });
  it("escapes text and UID injection", () => {
    expect(escapeCalendarText("a\\b;c,d\r\nhello\rbye\nend")).toBe(
      "a\\\\b\\;c\\,d\\nhello\\nbye\\nend",
    );
    const malicious = {
      ...plan,
      tasks: plan.tasks.map((task, index) =>
        index === 0
          ? {
              ...task,
              id: "test\r\nBEGIN:ATTACK",
              title: "नमस्ते, Bengaluru; welcome",
            }
          : task,
      ),
    };
    const calendar = createCalendar(malicious);
    expect(calendar).not.toContain("\r\nBEGIN:ATTACK");
    expect(calendar).toContain("test%0D%0ABEGIN%3AATTACK");
    expect(calendar).toContain("Bengaluru\\; welcome");
  });
  it("folds UTF-8 without splitting code points", () => {
    const text = "नमस्ते🌸".repeat(40);
    const folded = foldCalendarLine(text);
    expect(folded.replace(/\r\n /g, "")).toBe(text);
    expect(
      folded
        .split("\r\n")
        .every((line) => new TextEncoder().encode(line).length <= 75),
    ).toBe(true);
  });
});

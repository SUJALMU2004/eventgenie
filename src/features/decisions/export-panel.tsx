"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  createBackup,
  parseBackup,
  cloneImportedWorkspace,
  createCalendar,
  MAX_BACKUP_BYTES,
} from "@/lib/portability";
import { planRepository } from "@/lib/storage/repository";
import type { Workspace } from "@/lib/planning/workspace";
import { DecisionPanel, type DecisionProps } from "./types";
function download(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ExportPanel({ workspace, confirm }: DecisionProps) {
  const [importedId, setImportedId] = useState("");
  const [preview, setPreview] = useState<Workspace>(),
    [error, setError] = useState(""),
    [includeTasks, setIncludeTasks] = useState(true);
  function print() {
    const details = [
        ...document.querySelectorAll<HTMLDetailsElement>("#main details"),
      ],
      previous = details.map((item) => item.open);
    details.forEach((item) => {
      item.open = true;
    });
    const restore = () =>
      details.forEach((item, index) => {
        item.open = previous[index];
      });
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
  }
  return (
    <DecisionPanel
      id="export"
      title="Export & backup"
      description="Print, download a calendar, or keep a private JSON copy."
      printable={false}
    >
      <p className="notice">
        Backups and printed plans may contain private event, vendor and contact
        details. Store them securely. Import files stay in your browser and are
        never uploaded.
      </p>
      <div className="action-row">
        <Button variant="secondary" onClick={print}>
          Print event plan
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            download(
              createBackup(workspace),
              `eventgenie-${workspace.plan.id}.json`,
              "application/json",
            )
          }
        >
          Download JSON backup
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            download(
              createCalendar(workspace.plan, includeTasks),
              `eventgenie-${workspace.plan.id}.ics`,
              "text/calendar;charset=utf-8",
            )
          }
        >
          Download calendar
        </Button>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={includeTasks}
          onChange={(event) => setIncludeTasks(event.target.checked)}
        />
        Include dated planning tasks in calendar
      </label>
      <p className="small-text muted">
        Calendar entries are all-day dates. No unsupported travel or
        event-time-zone assumptions are added.
      </p>
      <label className="standalone-label">
        Restore a JSON backup
        <input
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(undefined);
            setError("");
            if (!file) return;
            if (file.size > MAX_BACKUP_BYTES) {
              setError("Backup files must be 2 MiB or smaller.");
              return;
            }
            void file
              .text()
              .then((text) => setPreview(parseBackup(text)))
              .catch((error) =>
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not read the backup",
                ),
              );
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="error-notice">
          {error}
        </p>
      ) : null}
      {importedId ? (
        <p className="notice" role="status">
          Backup imported as a separate event.{" "}
          <Link href={`/plans/${importedId}`}>Open restored plan</Link>
        </p>
      ) : null}
      {preview ? (
        <div className="import-preview">
          <h3>Review backup before importing</h3>
          <dl className="review-list">
            <div>
              <dt>Event</dt>
              <dd>{preview.plan.event.title}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{preview.plan.event.eventType}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{preview.plan.event.date}</dd>
            </div>
            <div>
              <dt>Records</dt>
              <dd>
                {preview.plan.tasks.length} tasks,{" "}
                {preview.enhancements.quotes.length} quotes,{" "}
                {preview.enhancements.scenarios.length} scenarios
              </dd>
            </div>
          </dl>
          <p className="small-text">
            Import creates a new plan with new IDs. Existing plans are never
            overwritten or silently merged.
          </p>
          <Button
            onClick={() =>
              confirm({
                title: "Import this private backup as a new plan?",
                description:
                  "A separate local event will be created. Owned IDs and links are remapped. No existing plan will be changed or merged.",
                action: async () => {
                  try {
                    const imported = cloneImportedWorkspace(preview);
                    await planRepository.importWorkspace(imported);
                    setImportedId(imported.plan.id);
                    return true;
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Import could not be saved. Existing plans are unchanged.",
                    );
                    return false;
                  }
                },
              })
            }
          >
            Import as a new plan
          </Button>
          <Button variant="ghost" onClick={() => setPreview(undefined)}>
            Cancel import preview
          </Button>
        </div>
      ) : null}
    </DecisionPanel>
  );
}

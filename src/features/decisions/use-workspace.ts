"use client";
import { useEffect, useRef, useState } from "react";
import type { EventPlan } from "@/schemas/plan";
import {
  emptyEnhancements,
  type PlanEnhancements,
} from "@/schemas/enhancements";
import {
  planRepository,
  StorageFailure,
  revisionSource,
} from "@/lib/storage/repository";
import { emptyHistory, type PlanHistory } from "@/lib/history";
import { validateWorkspace, type Workspace } from "@/lib/planning/workspace";
import type { Mutation } from "./types";
export function useWorkspace(
  plan: EventPlan,
  onPlanChange: (value: EventPlan) => void,
  initiallySaved = false,
) {
  const [enhancements, setEnhancements] = useState<PlanEnhancements>(() =>
    emptyEnhancements(plan.id),
  );
  const [history, setHistory] = useState<PlanHistory>(() =>
    emptyHistory(plan.id),
  );
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [missing, setMissing] = useState(false),
    [notice, setNotice] = useState("");
  const locked = useRef(false),
    persisted = useRef(initiallySaved);
  const onChangeRef = useRef(onPlanChange);
  useEffect(() => {
    onChangeRef.current = onPlanChange;
  }, [onPlanChange]);
  useEffect(() => {
    let active = true;
    void planRepository
      .loadWorkspace(plan.id)
      .then(async (value) => {
        if (active) {
          persisted.current = value !== undefined || initiallySaved;
          setEnhancements(value?.enhancements ?? emptyEnhancements(plan.id));
          if (value) onChangeRef.current(value.plan);
          else if (initiallySaved) {
            setMissing(true);
            setNotice(
              "This event is no longer saved in this browser. Its open content is preserved; export a backup if needed.",
            );
          }
        }
        const stored = await planRepository.loadHistory(plan.id);
        if (active) {
          if (stored && stored.revision !== (value?.enhancements.revision ?? 0))
            setNotice(
              "Another tab changed this event while it was loading. Reload the latest saved version before making changes.",
            );
          else
            setHistory(
              stored ?? emptyHistory(plan.id, value?.enhancements.revision),
            );
        }
      })
      .catch((error) => {
        if (active)
          setNotice(
            error instanceof Error
              ? error.message
              : "Planning storage is unavailable. Keep this tab open.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // Some browser policies expose the API but reject its construction.
    // Notifications are optional; atomic revision checks still protect writes.
    let channel: BroadcastChannel | undefined;
    try {
      if (typeof BroadcastChannel !== "undefined")
        channel = new BroadcastChannel("eventgenie-revisions");
    } catch {}
    if (channel)
      channel.onmessage = (event) => {
        if (
          active &&
          event.data?.planId === plan.id &&
          event.data.source !== revisionSource
        )
          setNotice(
            "Another tab updated this event. Reload the latest saved version before making changes.",
          );
      };
    return () => {
      active = false;
      channel?.close();
    };
  }, [plan.id, initiallySaved]);
  const workspace: Workspace = { plan, enhancements };
  async function accept(next: Workspace) {
    persisted.current = true;
    setEnhancements(next.enhancements);
    onPlanChange(next.plan);
    setDirty(false);
    setMissing(false);
    try {
      const stored = await planRepository.loadHistory(plan.id);
      if (stored && stored.revision !== next.enhancements.revision) {
        setHistory(emptyHistory(plan.id, next.enhancements.revision));
        return false;
      }
      setHistory(stored ?? emptyHistory(plan.id, next.enhancements.revision));
      return true;
    } catch {
      setHistory(emptyHistory(plan.id, next.enhancements.revision));
      return false;
    }
  }
  async function update(
    mutation: Mutation,
    description?: string,
  ): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      const next = await planRepository.mutateWorkspace(
        plan.id,
        (current) => {
          if (current.enhancements.revision !== enhancements.revision)
            throw new StorageFailure(
              "CONFLICT",
              "Another tab changed this event. Your unsaved decisions remain in this tab; reload the latest plan before replacing them.",
            );
          return mutation(dirty ? workspace : current);
        },
        persisted.current ? undefined : plan,
        { expectedRevision: enhancements.revision, description },
      );
      const historyReady = await accept(next);
      setNotice(
        historyReady
          ? description === "Update task completion" ||
            description === "Update supplier checklist"
            ? "Checklist progress saved in this browser."
            : "Event decisions saved in this browser."
          : "Changes saved, but history could not be reloaded. Reload the saved event before using undo.",
      );
      return true;
    } catch (error) {
      if (
        error instanceof StorageFailure &&
        ["UNAVAILABLE", "WRITE_FAILED"].includes(error.code)
      ) {
        try {
          const next = mutation(workspace),
            valid = validateWorkspace(next.plan, next.enhancements);
          if (valid.plan.id !== plan.id)
            throw new Error("A workspace update cannot change its event ID");
          setEnhancements(valid.enhancements);
          onPlanChange(valid.plan);
          setDirty(true);
          setNotice(
            "Changes are kept in this tab but could not be saved. Keep the tab open and retry saving.",
          );
          return true;
        } catch (invalid) {
          setNotice(
            invalid instanceof Error
              ? invalid.message
              : "The change was invalid.",
          );
          return false;
        }
      }
      setNotice(
        error instanceof Error ? error.message : "Nothing was changed.",
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function travel(direction: "undo" | "redo"): Promise<boolean> {
    if (locked.current || dirty) return false;
    locked.current = true;
    setBusy(true);
    try {
      await accept(
        await planRepository.restoreHistory(
          plan.id,
          direction,
          enhancements.revision,
        ),
      );
      setNotice(
        direction === "undo"
          ? "Change undone and saved."
          : "Change redone and saved.",
      );
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not restore history.",
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function reload(): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      const latest = await planRepository.loadWorkspace(plan.id);
      if (!latest) {
        setMissing(true);
        throw new Error("This event was deleted in another tab.");
      }
      await accept(latest);
      setNotice(
        "Latest saved event reloaded. Review any open drafts before applying them.",
      );
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not reload this event.",
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    workspace,
    history,
    loading,
    busy,
    dirty,
    missing,
    notice,
    update,
    travel,
    reload,
    setNotice,
  };
}
export type WorkspaceState = ReturnType<typeof useWorkspace>;

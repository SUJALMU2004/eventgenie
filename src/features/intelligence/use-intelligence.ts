"use client";
import { useEffect, useRef, useState } from "react";
import {
  buildIntelligenceRequest,
  normalizeIntelligence,
  offlineIntelligence,
  intelligenceFingerprint,
  requestIdentity,
  type IntelligenceOptions,
} from "@/lib/ai/intelligence";
import type { intelligencePreviewSchema } from "@/schemas/intelligence";
import {
  intelligenceStreamSchema,
  emptyIntelligence,
  type IntelligenceOutput,
  type IntelligenceRequest,
} from "@/schemas/intelligence";
import type { z } from "zod";
import { consumeStructuredStream } from "@/lib/ndjson-client";
import { safeError, failure } from "@/lib/errors";
import {
  cachedIntelligence,
  cacheIntelligence,
} from "@/lib/ai/intelligence-cache";
import type { DecisionProps } from "@/features/decisions/types";
import type { Workspace } from "@/lib/planning/workspace";
type Proposal = {
  output: IntelligenceOutput;
  input: IntelligenceRequest;
  identity: string;
  source: "ai" | "demo" | "cache";
  options: IntelligenceOptions;
  fingerprint: string;
};
export function useIntelligence(
  props: DecisionProps,
  options: IntelligenceOptions,
) {
  const [proposal, setProposal] = useState<Proposal>(),
    [generating, setGenerating] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [retryAt, setRetryAt] = useState(0);
  const [partial, setPartial] =
    useState<z.infer<typeof intelligencePreviewSchema>>();
  const controller = useRef<AbortController | null>(null),
    locked = useRef(false);
  let identity = "";
  try {
    identity = requestIdentity(
      props.workspace,
      buildIntelligenceRequest(props.workspace, options),
    );
  } catch {
    // Incomplete local options have no valid identity. Generation reports the
    // validation error; an existing proposal is treated as stale in the meantime.
  }
  const latest = useRef(identity);
  useEffect(() => {
    latest.current = identity;
    return () => controller.current?.abort();
  }, [identity]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(
      () => setRetryAt(0),
      Math.min(Math.max(0, retryAt - Date.now()), 2147483647),
    );
    return () => clearTimeout(timer);
  }, [retryAt]);
  async function generate(demo = false) {
    if (locked.current || (!demo && retryAt > Date.now())) return;
    locked.current = true;
    setGenerating(true);
    setError("");
    setProposal(undefined);
    setPartial(undefined);
    setStatus("Checking relevant plan context…");
    const control = new AbortController();
    controller.current = control;
    try {
      const input = buildIntelligenceRequest(props.workspace, options),
        original = requestIdentity(props.workspace, input),
        fingerprint = await intelligenceFingerprint(props.workspace, input);
      const cached = cachedIntelligence(
        props.workspace.enhancements.intelligence,
        fingerprint,
        input,
      );
      let output: IntelligenceOutput, source: Proposal["source"];
      if (demo) {
        output = offlineIntelligence(input);
        source = "demo";
      } else if (cached) {
        output = cached;
        source = "cache";
      } else {
        setStatus("Generating plan-specific suggestions…");
        const response = await fetch("/api/plans/intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: control.signal,
        });
        output = normalizeIntelligence(
          input,
          await consumeStructuredStream(
            response,
            (preview) => {
              setPartial(preview);
              setStatus(
                `Validated ${preview.section} content received; awaiting the complete response.`,
              );
            },
            intelligenceStreamSchema,
          ),
        );
        source = "ai";
      }
      control.signal.throwIfAborted();
      if (latest.current !== original)
        throw failure(
          "ABORTED",
          "The plan or question changed. Generate a fresh preview.",
          499,
        );
      setProposal({
        output,
        input,
        identity: original,
        source,
        options: structuredClone(options),
        fingerprint,
      });
      setPartial(undefined);
      setStatus(
        source === "demo"
          ? "Deterministic sample preview ready. Nothing applied."
          : source === "cache"
            ? "Validated cached AI preview reused. Nothing applied."
            : "Complete and validated. Review before applying anything.",
      );
      if (source === "ai")
        await props.update((current) => {
          const intelligence =
            current.enhancements.intelligence ?? emptyIntelligence();
          return {
            ...current,
            enhancements: {
              ...current.enhancements,
              intelligence: cacheIntelligence(
                intelligence,
                fingerprint,
                output,
              ),
            },
          };
        });
    } catch (value) {
      setPartial(undefined);
      const safe = safeError(value);
      setError(safe.detail.message);
      setStatus(
        safe.detail.code === "ABORTED"
          ? "Cancelled. Original plan preserved."
          : "Failed. Your work is preserved.",
      );
      if (safe.detail.retryAfter)
        setRetryAt(Date.now() + safe.detail.retryAfter * 1000);
    } finally {
      locked.current = false;
      setGenerating(false);
    }
  }
  function assertCurrent(current: Workspace) {
    if (
      !proposal ||
      requestIdentity(current, buildIntelligenceRequest(current, options)) !==
        proposal.identity
    )
      throw new Error(
        "The relevant plan context changed. Generate a fresh preview before applying it.",
      );
    return normalizeIntelligence(proposal.input, proposal.output);
  }
  return {
    partial,
    stale: Boolean(proposal && identity !== proposal.identity),
    proposal,
    generating,
    status,
    error,
    retryAt,
    generate,
    assertCurrent,
    cancel: () => controller.current?.abort(),
    reject: () => {
      setProposal(undefined);
      setPartial(undefined);
      setStatus("Preview rejected. Original plan preserved.");
    },
  };
}

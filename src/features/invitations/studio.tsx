"use client";
import { useRef, useState } from "react";
import { DecisionPanel, type DecisionProps } from "@/features/decisions/types";
import {
  invitationToneSchema,
  emptyIntelligence,
  type PlanIntelligence,
} from "@/schemas/intelligence";
import {
  invitationBody,
  invitationTemplate,
  composeInvitation,
  copyInvitation,
  shareInvitation,
  downloadText,
} from "@/lib/invitations";
import { validateWorkspace } from "@/lib/planning/workspace";
import { Button } from "@/components/ui/button";
import { useIntelligence } from "@/features/intelligence/use-intelligence";
import { AIControls } from "@/features/intelligence/ai-controls";
import { IntelligencePreview } from "@/features/intelligence/preview";
export function InvitationStudio(props: DecisionProps) {
  const { plan, enhancements } = props.workspace;
  const [index, setIndex] = useState(0),
    [body, setBody] = useState(invitationBody(plan.invitations[0])),
    [original, setOriginal] = useState(plan.invitations[0]),
    [facts, setFacts] = useState<PlanIntelligence["invitationFacts"]>(
      enhancements.intelligence?.invitationFacts ??
        emptyIntelligence().invitationFacts,
    ),
    [originalFacts, setOriginalFacts] = useState(
      JSON.stringify(
        enhancements.intelligence?.invitationFacts ??
          emptyIntelligence().invitationFacts,
      ),
    ),
    [tone, setTone] = useState<ReturnType<typeof invitationToneSchema.parse>>(
      plan.event.eventType === "wedding"
        ? "elegant"
        : plan.event.eventType === "birthday"
          ? "playful"
          : "friendly",
    ),
    [length, setLength] = useState<"short" | "detailed">("short"),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const ai = useIntelligence(props, {
    operation: "invitation-refinement",
    tone,
    length,
  });
  const preview = invitationPreview(plan, body, facts);
  function choose(value: number) {
    setIndex(value);
    setOriginal(plan.invitations[value]);
    setBody(invitationBody(plan.invitations[value]));
    setFacts(
      enhancements.intelligence?.invitationFacts ??
        emptyIntelligence().invitationFacts,
    );
    setOriginalFacts(
      JSON.stringify(
        enhancements.intelligence?.invitationFacts ??
          emptyIntelligence().invitationFacts,
      ),
    );
    setError("");
  }
  function accept(useAI = false) {
    try {
      const output = useAI ? ai.assertCurrent(props.workspace) : undefined;
      const proposedBody =
        output?.kind === "invitation"
          ? `${output.opening}\n\n${output.closing}`
          : body;
      const text = composeInvitation(plan, proposedBody, facts);
      props.confirm({
        title: "Save this invitation draft?",
        description: `Only invitation ${index + 1} and the entered local invitation details change. The event title, date and city are inserted from the plan. Nothing is sent. This change can be undone.`,
        action: async () => {
          const ok = await props.update((current) => {
            if (useAI) ai.assertCurrent(current);
            if (
              current.plan.invitations[index] !== original ||
              JSON.stringify(
                current.enhancements.intelligence?.invitationFacts ??
                  emptyIntelligence().invitationFacts,
              ) !== originalFacts
            )
              throw new Error(
                "The invitation changed while you were editing. Load its latest draft before replacing it.",
              );
            const invitations = current.plan.invitations.map(
                (item, draftIndex) => (draftIndex === index ? text : item),
              ),
              intelligence =
                current.enhancements.intelligence ?? emptyIntelligence();
            return validateWorkspace(
              { ...current.plan, invitations },
              {
                ...current.enhancements,
                cache: [],
                intelligence: {
                  ...intelligence,
                  invitationFacts: facts,
                  cache: [],
                },
              },
            );
          }, "Save reviewed invitation variant");
          if (ok) {
            setBody(proposedBody);
            setOriginal(text);
            setOriginalFacts(JSON.stringify(facts));
            setStatus("Invitation draft saved locally. Nothing has been sent.");
          }
          return ok;
        },
      });
      setError("");
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Check invitation details.",
      );
    }
  }
  return (
    <DecisionPanel
      id="invitation-studio"
      title="Your invitation, your voice"
      description="Edit one draft, try a tone, and keep verified facts intact. Copy, download or share only when you choose."
    >
      <div className="form-grid">
        <label>
          Selected invitation draft
          <select
            value={index}
            onChange={(e) => choose(Number(e.target.value))}
          >
            {plan.invitations.map((_, draftIndex) => (
              <option key={draftIndex} value={draftIndex}>
                Invitation {draftIndex + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Invitation tone
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as typeof tone)}
          >
            {invitationToneSchema.options.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Invitation length
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as typeof length)}
          >
            <option value="short">Short</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          setBody(invitationTemplate(tone, length, plan.event.eventType));
          setStatus("Local tone template preview loaded. Nothing saved yet.");
        }}
      >
        Preview local tone template
      </Button>
      <label>
        Invitation message
        <textarea
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <fieldset>
        <legend>Verified invitation facts — kept in this browser</legend>
        <p>
          {plan.event.title} · {plan.event.date} · {plan.event.city}. Missing
          details remain labelled placeholders.
        </p>
        <div className="form-grid">
          <label>
            Verified event time (optional)
            <input
              maxLength={80}
              value={facts.time}
              onChange={(e) => setFacts({ ...facts, time: e.target.value })}
            />
          </label>
          <label>
            Verified venue details (optional)
            <input
              maxLength={200}
              value={facts.venue}
              onChange={(e) => setFacts({ ...facts, venue: e.target.value })}
            />
          </label>
          <label>
            Your RSVP instructions (optional)
            <textarea
              maxLength={200}
              value={facts.rsvp}
              onChange={(e) => setFacts({ ...facts, rsvp: e.target.value })}
            />
          </label>
        </div>
      </fieldset>
      <h3>Original → proposed invitation</h3>
      <details>
        <summary>Original saved draft</summary>
        <p className="content-preview">{original}</p>
      </details>
      <label>
        Full invitation preview
        <textarea ref={textRef} readOnly value={preview} rows={10} />
      </label>
      {!preview ? (
        <p role="alert">
          Enter an invitation message within the allowed length.
        </p>
      ) : null}
      {original !== plan.invitations[index] ? (
        <p className="error-notice">
          The saved invitation changed.{" "}
          <Button variant="ghost" onClick={() => choose(index)}>
            Load latest invitation
          </Button>
        </p>
      ) : null}
      <div className="button-row">
        <Button disabled={props.busy || !preview} onClick={() => accept()}>
          Review invitation changes
        </Button>
        <Button
          variant="secondary"
          disabled={!preview}
          onClick={() =>
            void copyInvitation(preview, navigator.clipboard).then((result) => {
              if (result === "manual") {
                textRef.current?.focus();
                textRef.current?.select();
                setStatus(
                  "Clipboard unavailable. The full preview is selected; use your keyboard to copy.",
                );
              } else setStatus("Invitation copied. Nothing has been sent.");
            })
          }
        >
          Copy full invitation
        </Button>
        <Button
          variant="secondary"
          disabled={!preview}
          onClick={() => {
            downloadText(
              preview,
              `eventgenie-${plan.event.eventType}-invitation.txt`,
            );
            setStatus("Invitation text downloaded locally.");
          }}
        >
          Download invitation text
        </Button>
        <Button
          variant="ghost"
          disabled={!preview}
          onClick={() =>
            void shareInvitation(
              preview,
              navigator.share?.bind(navigator),
            ).then((result) =>
              setStatus(
                result === "shared"
                  ? "Passed to your selected share target; delivery is not confirmed."
                  : result === "cancelled"
                    ? "Sharing cancelled. Nothing changed."
                    : "Native sharing unavailable. Use Copy or Download instead.",
              ),
            )
          }
        >
          Share invitation
        </Button>
      </div>
      <p role="status">{status}</p>
      {error ? (
        <p role="alert" className="error-notice">
          {error}
        </p>
      ) : null}
      <details className="ai-operation">
        <summary>Regenerate selected draft with optional AI</summary>
        <p className="small-text">
          Only generic tone/length context goes to AI. Existing invitation
          content, names, venue details and RSVP instructions stay local.
        </p>
        <AIControls state={ai} label="invitation variant" />
        {ai.proposal?.output.kind === "invitation" ? (
          <>
            <IntelligencePreview output={ai.proposal.output} />
            <p>Recorded event facts will be inserted locally when accepted.</p>
            <Button
              disabled={props.busy || ai.generating || ai.stale}
              onClick={() => accept(true)}
            >
              Review AI invitation variant
            </Button>
          </>
        ) : null}
      </details>
    </DecisionPanel>
  );
}

function invitationPreview(
  ...args: Parameters<typeof composeInvitation>
): string {
  try {
    return composeInvitation(...args);
  } catch {
    // Incomplete facts are expected during editing; the studio shows its validation notice.
    return "";
  }
}

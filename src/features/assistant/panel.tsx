"use client";
import { useMemo, useState } from "react";
import { DecisionPanel, type DecisionProps } from "@/features/decisions/types";
import { Button } from "@/components/ui/button";
import {
  planFacts,
  exactFinancialQuestion,
  taskReferences,
} from "@/lib/ai/intelligence";
import { formatMoney } from "@/features/budget/engine";
import { emptyIntelligence } from "@/schemas/intelligence";
import { useIntelligence } from "@/features/intelligence/use-intelligence";
import { AIControls } from "@/features/intelligence/ai-controls";
import { IntelligencePreview } from "@/features/intelligence/preview";
const sections = new Map([
  ["budget", "budget-title"],
  ["vendors", "vendors-title"],
  ["timeline", "timeline-title"],
  ["invitations", "invitations-title"],
  ["schedule", "day-of"],
  ["overview", "overview-title"],
]);
export function AssistantPanel(props: DecisionProps) {
  const [question, setQuestion] = useState("What should I finish this week?"),
    [showFacts, setShowFacts] = useState(false);
  const facts = useMemo(
    () => planFacts(props.workspace, question),
    [props.workspace, question],
  );
  const ai = useIntelligence(props, { operation: "ask-plan", question });
  const money = (amount: number) =>
      formatMoney(amount, props.workspace.plan.event.currency),
    refs = taskReferences(props.workspace);
  return (
    <DecisionPanel
      id="ask-eventgenie"
      title="Ask EventGenie"
      description="Questions grounded in this event. Exact figures stay under the deterministic engine's control."
    >
      <div
        className="suggested-questions"
        role="group"
        aria-label="Suggested planning questions"
      >
        {[
          "What should I finish this week?",
          "How much budget remains?",
          `How can I simplify this ${props.workspace.plan.event.eventType}?`,
          "What happens if 30 extra guests attend?",
          "Which vendor category needs attention?",
        ].map((text) => (
          <Button
            key={text}
            variant="secondary"
            size="small"
            onClick={() => {
              setQuestion(text);
              setShowFacts(true);
            }}
          >
            {text}
          </Button>
        ))}
      </div>
      <label>
        Your plan-specific question
        <textarea
          maxLength={400}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setShowFacts(false);
          }}
          aria-describedby="assistant-privacy"
        />
      </label>
      <p id="assistant-privacy" className="small-text muted">
        Do not enter guest names, contacts or sensitive notes. Optional AI
        receives only this question and relevant category/date/status facts;
        never private task titles, vendor contacts, invitation text or full
        records.
      </p>
      <Button onClick={() => setShowFacts(true)}>
        Show calculated plan facts
      </Button>
      {showFacts || ai.proposal ? (
        <section className="notice" aria-label="Deterministic plan facts">
          <h3>Facts and calculations from this plan</h3>
          <dl className="fact-grid">
            <dt>Recorded paid expenses</dt>
            <dd>{money(facts.finance.paidMinor)}</dd>
            <dt>Protected commitments including paid amounts</dt>
            <dd>{money(facts.finance.protectedMinor)}</dd>
            <dt>Uncommitted budget</dt>
            <dd>
              {money(facts.finance.uncommittedMinor)} before the planned reserve
              and other unbooked allocations
            </dd>
            <dt>Current shortfall</dt>
            <dd>{money(facts.finance.shortfallMinor)}</dd>
            <dt>Readiness</dt>
            <dd>{facts.readiness.status}</dd>
            <dt>Tasks due this week</dt>
            <dd>{facts.readiness.upcoming.length}</dd>
          </dl>
          {facts.extraGuestTotal ? (
            <p>
              The stated guest increase gives {facts.extraGuestTotal} guests.
              The recorded budget stays unchanged; no per-guest cost or supplier
              capacity is assumed.
            </p>
          ) : null}
          <ul>
            {facts.tasks.map((task) => (
              <li key={task.id}>
                <a href={`#${task.id}`}>{task.title}</a> · due {task.dueDate}
              </li>
            ))}
          </ul>
          <ul>
            {facts.readiness.findings
              .filter((finding) => finding.ruleId === "RULE_VENDOR_NOT_BOOKED")
              .map((finding, index) => (
                <li key={index}>{finding.message}</li>
              ))}
          </ul>
        </section>
      ) : null}
      {exactFinancialQuestion(question) ? (
        <p className="notice">
          This exact financial question is answered locally. No AI request is
          needed.
        </p>
      ) : (
        <>
          <AIControls state={ai} label="plan answer" />
          {ai.proposal?.output.kind === "answer" ? (
            <>
              <IntelligencePreview output={ai.proposal.output} />
              <nav aria-label="Validated answer references">
                {ai.proposal.output.references
                  .filter((ref) => refs.has(ref) || sections.has(ref))
                  .map((ref) => (
                    <a
                      key={ref}
                      href={`#${refs.get(ref) ?? sections.get(ref)}`}
                    >
                      {refs.has(ref)
                        ? props.workspace.plan.tasks.find(
                            (task) => task.id === refs.get(ref),
                          )?.title
                        : ref}{" "}
                    </a>
                  ))}
              </nav>
              <Button
                variant="secondary"
                disabled={props.busy || ai.generating || ai.stale}
                onClick={() =>
                  void props.update((current) => {
                    const answer = ai.assertCurrent(current);
                    const intelligence =
                      current.enhancements.intelligence ?? emptyIntelligence();
                    return {
                      ...current,
                      enhancements: {
                        ...current.enhancements,
                        intelligence: {
                          ...intelligence,
                          exchanges: [
                            ...intelligence.exchanges,
                            {
                              id: crypto.randomUUID(),
                              question: ai.proposal!.input.question,
                              answer,
                              createdAt: new Date().toISOString(),
                              fingerprint: ai.proposal!.fingerprint,
                              source: ai.proposal!.source,
                            },
                          ].slice(-5),
                        },
                      },
                    };
                  })
                }
              >
                Keep answer in this event
              </Button>
            </>
          ) : null}
        </>
      )}
      <details>
        <summary>Recent saved answers (up to five)</summary>
        {props.workspace.enhancements.intelligence?.exchanges.length ? (
          props.workspace.enhancements.intelligence.exchanges
            .slice()
            .reverse()
            .map((exchange) => (
              <article key={exchange.id}>
                <h3>{exchange.question}</h3>
                <p className="small-text">
                  {exchange.source === "demo"
                    ? "Deterministic sample"
                    : "AI answer"}{" "}
                  · saved {exchange.createdAt.slice(0, 10)}. Historical advice;
                  recompute facts after plan changes.
                </p>
                <IntelligencePreview output={exchange.answer} />
              </article>
            ))
        ) : (
          <p>
            No saved answers yet. Conversations are isolated to this event and
            are not automatically sent back to Google.
          </p>
        )}
      </details>
    </DecisionPanel>
  );
}

"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { allocateBudget, formatMoney } from "@/features/budget/engine";
import {
  OccasionFields,
  EssentialFields,
  PersonalisationFields,
} from "./steps";
import { EventReview } from "./review";
import { GenerationView } from "./generation-view";
import { useEventWizard, type WizardOptions } from "./use-event-wizard";
const PlanDashboard = dynamic(
  () =>
    import("@/features/event-plan/dashboard").then(
      (module) => module.PlanDashboard,
    ),
  {
    loading: () => (
      <p className="loading-state" role="status">
        Opening your event blueprint…
      </p>
    ),
  },
);
const steps = ["Occasion", "Essentials", "Personal touches", "Review"];
export function EventWizard({ initialType, sampleType }: WizardOptions) {
  const {
    event,
    budgetText,
    setBudgetText,
    step,
    errors,
    initialized,
    storageNotice,
    error,
    busy,
    preview,
    status,
    result,
    saved,
    resultNotice,
    heading,
    abort,
    update,
    goTo,
    nextStep,
    inputProps,
    generate,
  } = useEventWizard({ initialType, sampleType });

  if (result)
    return (
      <PlanDashboard
        initialPlan={result}
        initiallySaved={saved}
        initialNotice={resultNotice}
      />
    );
  if (!initialized)
    return (
      <main id="main" className="page-width loading-state">
        <p role="status">Opening your planning space…</p>
        <div className="skeleton" aria-hidden="true" />
      </main>
    );
  return (
    <main id="main" className="page-width planning-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={15} aria-hidden="true" /> Back to the good stuff
      </Link>
      <div className="planning-heading">
        <p className="eyebrow">LET’S MAKE IT MEMORABLE</p>
        <h1>A great celebration starts here.</h1>
        <p>A few details from you. A thoughtful plan for everything ahead.</p>
      </div>
      {busy ? (
        <GenerationView
          preview={preview}
          status={status}
          cancel={() => abort.current?.abort()}
        />
      ) : (
        <div className="wizard-layout">
          <div className="wizard-card">
            <nav aria-label="Event setup progress">
              <ol className="wizard-steps">
                {steps.map((label, index) => (
                  <li
                    key={label}
                    aria-current={index === step ? "step" : undefined}
                  >
                    <button
                      type="button"
                      disabled={index > step}
                      onClick={() => goTo(index)}
                    >
                      <span>{index + 1}</span>
                      <span>{label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <form
              noValidate
              onSubmit={(submit) => {
                submit.preventDefault();
                if (step < 3) nextStep();
                else void generate();
              }}
            >
              <div className="wizard-content">
                <p className="eyebrow">STEP {step + 1} OF 4</p>
                <h2 tabIndex={-1} ref={heading}>
                  {
                    [
                      "What’s the occasion?",
                      "Let’s get the essentials right.",
                      "Make it feel like you.",
                      "One last look before the magic.",
                    ][step]
                  }
                </h2>
                <p className="muted">
                  {
                    [
                      "Big or small, we’ll help you make it special.",
                      "These details keep your plan practical and your budget grounded.",
                      "All optional. A little personality goes a long way.",
                      "Check the details. You can edit anything before generating.",
                    ][step]
                  }
                </p>
                {sampleType ? (
                  <p className="notice">
                    Sample event details are loaded. Choose “Create sample plan”
                    for deterministic demo data, or generate a real AI plan.
                  </p>
                ) : null}
                <OccasionFields
                  event={event}
                  update={update}
                  inputProps={inputProps}
                  errors={errors}
                />
                <EssentialFields
                  event={event}
                  update={update}
                  inputProps={inputProps}
                  errors={errors}
                  budgetText={budgetText}
                  setBudgetText={setBudgetText}
                />
                <PersonalisationFields
                  event={event}
                  update={update}
                  inputProps={inputProps}
                  errors={errors}
                />
                {step === 3 ? (
                  <>
                    <EventReview event={event} edit={goTo} />
                    <p className="privacy-note">
                      <ShieldCheck size={19} aria-hidden="true" /> Generating
                      sends your event requirements to Google. Free-tier
                      submissions may improve Google products. Your completed
                      plan is stored in this browser.{" "}
                      <Link href="/privacy">Privacy details</Link>
                    </p>
                  </>
                ) : null}
                {Object.keys(errors).length ? (
                  <p className="form-error-summary" role="alert">
                    Please check the highlighted fields before continuing.
                  </p>
                ) : null}
                {error ? (
                  <div className="error-notice" role="alert">
                    <strong>A small pause in the planning.</strong>
                    <p>{error}</p>
                  </div>
                ) : null}
              </div>
              <div className="wizard-actions">
                {step > 0 ? (
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => goTo(step - 1)}
                  >
                    <ArrowLeft size={16} aria-hidden="true" /> Back
                  </Button>
                ) : (
                  <span className="muted small-text">
                    Your next happy moment starts here.
                  </span>
                )}
                <Button type="submit">
                  {step === 3 ? (
                    <>
                      <Sparkles size={17} aria-hidden="true" /> Generate my
                      event plan
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight size={17} aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
              {step === 3 ? (
                <div className="sample-action">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => void generate(true)}
                  >
                    Create sample plan · no AI call
                  </Button>
                  <p>Clearly labelled demo data, using your event details.</p>
                </div>
              ) : null}
            </form>
          </div>
          <aside className="planning-aside">
            <span className="aside-flower" aria-hidden="true">
              ✳
            </span>
            <h2>
              A plan that feels
              <br />
              <em>like your celebration.</em>
            </h2>
            <p>
              We’ll bring the moving pieces together. You keep the moments that
              matter.
            </p>
            <ul>
              <li>A budget with breathing room</li>
              <li>A timeline that makes sense</li>
              <li>Ideas with your personality</li>
              <li>A checklist you can actually use</li>
            </ul>
            {event.budgetMinor > 0 ? (
              <div className="aside-budget">
                <span>Your planning envelope</span>
                <strong>
                  {formatMoney(event.budgetMinor, event.currency)}
                </strong>
                <p>
                  {formatMoney(
                    allocateBudget(event.eventType, event.budgetMinor).at(-1)
                      ?.amountMinor ?? 0,
                    event.currency,
                  )}{" "}
                  set aside for surprises
                </p>
              </div>
            ) : null}
            <p className="small-text">
              <ShieldCheck size={14} aria-hidden="true" /> No account. Saved in
              this browser.
            </p>
          </aside>
        </div>
      )}
      {storageNotice ? (
        <p className="notice" role="status">
          {storageNotice}
        </p>
      ) : null}
    </main>
  );
}

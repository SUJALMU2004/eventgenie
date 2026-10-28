import { Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanPreview } from "@/schemas/plan";

export function GenerationView({
  preview,
  status,
  cancel,
}: {
  preview: PlanPreview;
  status: string;
  cancel: () => void;
}) {
  const milestones = [
    { label: "Event overview", ready: Boolean(preview.overview) },
    { label: "Planning timeline", ready: Boolean(preview.tasks?.length) },
    { label: "Vendor requirements", ready: Boolean(preview.vendors?.length) },
    { label: "Celebration ideas", ready: Boolean(preview.ideas?.length) },
  ];
  return (
    <section
      className="generation-view"
      aria-labelledby="generation-title"
      aria-busy="true"
    >
      <div className="generation-symbol">
        <Sparkles size={32} aria-hidden="true" />
      </div>
      <p className="eyebrow">A LITTLE ORGANISED MAGIC</p>
      <h2 id="generation-title">Your celebration is taking shape.</h2>
      <p role="status" aria-live="polite">
        {status}
      </p>
      <p className="muted">
        Live preview · Your plan is saved only after final validation.
      </p>
      <ul className="generation-stages">
        {milestones.map((item) => (
          <li key={item.label}>
            <span className={item.ready ? "stage-ready" : "stage-waiting"}>
              {item.ready ? <Check size={14} aria-hidden="true" /> : "·"}
            </span>
            {item.label}
            <small>
              {item.ready ? "Preview received" : "Waiting for content"}
            </small>
          </li>
        ))}
      </ul>
      {preview.overview ? (
        <div className="preview-card">
          <h3>First, the big picture</h3>
          <p>{preview.overview.description}</p>
        </div>
      ) : (
        <div className="skeleton" aria-hidden="true" />
      )}
      {preview.tasks?.length ? (
        <div className="preview-card">
          <h3>Your timeline, coming together</h3>
          <ul>
            {preview.tasks.slice(0, 5).map((task, index) => (
              <li key={index}>{task.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button variant="secondary" onClick={cancel}>
        Cancel generation
      </Button>
    </section>
  );
}

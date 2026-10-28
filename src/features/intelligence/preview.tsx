import type { IntelligenceOutput } from "@/schemas/intelligence";
export function IntelligencePreview({
  output,
}: {
  output: IntelligenceOutput;
}) {
  if (output.kind === "tasks")
    return (
      <ul>
        {output.tasks.map((task, index) => (
          <li key={index}>
            <strong>{task.title}</strong> — {task.reason}
            <p className="small-text">
              Assumptions: {task.assumptions.join(" ")}
            </p>
          </li>
        ))}
      </ul>
    );
  if (output.kind === "invitation")
    return (
      <blockquote>
        <p>{output.opening}</p>
        <p>{output.closing}</p>
      </blockquote>
    );
  return (
    <article className="notice">
      <h3>
        {output.kind === "answer"
          ? "AI-generated ideas and explanation"
          : "Qualitative contingency advice"}
      </h3>
      <p>{output.kind === "answer" ? output.answer : output.summary}</p>
      <ul>
        {(output.kind === "answer"
          ? output.ideas
          : output.immediateActions
        ).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      {output.kind === "playbook" ? (
        <>
          <h4>Alternative strategies</h4>
          <ul>
            {output.alternatives.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p>
        <strong>Assumptions:</strong> {output.assumptions.join(" ")}
      </p>
      <p>
        <strong>Limitations:</strong> {output.limitations.join(" ")}
      </p>
    </article>
  );
}

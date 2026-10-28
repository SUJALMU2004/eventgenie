"use client";
import { useId, useRef, useState } from "react";
import { fieldErrors } from "@/lib/validation";

/** Error associations and focus share one source of truth across advanced forms. */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const elements = useRef<Record<string, HTMLElement | null>>({});
  const summary = useRef<HTMLDivElement>(null);
  const id = useId();
  const errorId = (name: string) => `${id}-${name}-error`;
  function report(error: unknown) {
    const next = fieldErrors(error);
    setErrors(next);
    requestAnimationFrame(() => {
      const target = elements.current[Object.keys(next)[0]] ?? summary.current;
      target?.focus();
    });
  }
  function field(name: string) {
    return {
      ref: (element: HTMLElement | null) => {
        elements.current[name] = element;
      },
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? errorId(name) : undefined,
    };
  }
  return {
    errors,
    summaryRef: (element: HTMLDivElement | null) => {
      summary.current = element;
    },
    report,
    field,
    errorId,
    clear: () => setErrors({}),
  };
}
export function FormErrors({
  errors,
  errorId,
  summaryRef,
}: {
  errors: Record<string, string>;
  errorId: (name: string) => string;
  summaryRef: (element: HTMLDivElement | null) => void;
}) {
  if (!Object.keys(errors).length) return null;
  return (
    <div ref={summaryRef} tabIndex={-1} role="alert" className="error-notice">
      {Object.entries(errors).map(([name, message]) => (
        <p key={name} id={errorId(name)}>
          {message}
        </p>
      ))}
    </div>
  );
}

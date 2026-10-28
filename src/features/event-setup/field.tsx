import type { ReactNode } from "react";
export function Field({
  name,
  label,
  hint,
  error,
  children,
  wide = false,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`form-field${wide ? " field-wide" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint ? (
        <p className="field-hint" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

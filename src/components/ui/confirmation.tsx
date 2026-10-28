"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./button";
import type { Confirmation } from "@/features/decisions/types";
export function ConfirmationDialog({
  value,
  busy,
  close,
}: {
  value: Confirmation | null;
  busy: boolean;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  const [error, setError] = useState("");
  useEffect(() => {
    if (value) dialog.current?.showModal();
    else dialog.current?.close();
  }, [value]);
  return (
    <dialog ref={dialog} aria-labelledby={id} onCancel={close}>
      <h2 id={id}>{value?.title}</h2>
      <p>{value?.description}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="dialog-actions">
        <Button variant="secondary" disabled={busy} onClick={close}>
          Cancel
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            setError("");
            void value
              ?.action()
              .then(() => close())
              .catch(() =>
                setError(
                  "The change could not be applied. Your original saved data is preserved; cancel to review the details.",
                ),
              );
          }}
        >
          {busy ? "Saving…" : "Confirm change"}
        </Button>
      </div>
    </dialog>
  );
}

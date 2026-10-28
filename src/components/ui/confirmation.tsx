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
  const [failure, setFailure] = useState<{
    value: Confirmation;
    message: string;
  }>();
  const error = failure?.value === value ? failure.message : "";
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  useEffect(() => {
    if (value) dialog.current?.showModal();
    else dialog.current?.close();
  }, [value]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={id}
      aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
      aria-busy={busy}
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else close();
      }}
    >
      <h2 id={id}>{value?.title}</h2>
      <p id={descriptionId}>{value?.description}</p>
      {error ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      {busy ? <p role="status">Saving the reviewed change…</p> : null}
      <div className="dialog-actions">
        <Button variant="secondary" disabled={busy} onClick={close}>
          Cancel
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            if (!value) return;
            const selected = value;
            setFailure(undefined);
            const failed = () =>
              setFailure({
                value: selected,
                message:
                  "The change could not be applied. Your original saved data is preserved; cancel to review the details.",
              });
            void selected
              .action()
              .then((applied) => {
                if (applied) close();
                else failed();
              })
              .catch(failed);
          }}
        >
          {busy ? "Saving…" : "Confirm change"}
        </Button>
      </div>
    </dialog>
  );
}

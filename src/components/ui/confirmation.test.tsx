// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmationDialog } from "./confirmation";
import type { Confirmation } from "@/features/decisions/types";
const confirmation = (action: Confirmation["action"]): Confirmation => ({
  title: "Save reviewed change?",
  description: "Only the selected local record changes.",
  action,
});
it.each([false, true])(
  "closes only after a successful action (%s)",
  async (success) => {
    const close = vi.fn(),
      action = vi.fn().mockResolvedValue(success);
    render(
      <ConfirmationDialog
        value={confirmation(action)}
        busy={false}
        close={close}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleDescription(
      "Only the selected local record changes.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    if (success) await waitFor(() => expect(close).toHaveBeenCalledOnce());
    else {
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "could not be applied",
      );
      expect(close).not.toHaveBeenCalled();
      expect(dialog).toHaveAccessibleDescription(
        /original saved data is preserved/,
      );
    }
  },
);
it("retains rejected actions and clears stale errors for a different confirmation", async () => {
  const close = vi.fn(),
    value = confirmation(
      vi.fn().mockRejectedValue(new Error("Storage unavailable")),
    );
  const { rerender } = render(
    <ConfirmationDialog value={value} busy={false} close={close} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  await screen.findByRole("alert");
  expect(close).not.toHaveBeenCalled();
  rerender(
    <ConfirmationDialog
      value={confirmation(async () => true)}
      busy={false}
      close={close}
    />,
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(close).toHaveBeenCalledOnce();
  rerender(<ConfirmationDialog value={null} busy={false} close={close} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("announces pending saves and prevents cancellation while a commit is running", () => {
  const close = vi.fn();
  const { rerender } = render(
    <ConfirmationDialog
      value={confirmation(async () => true)}
      busy
      close={close}
    />,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent(
    "Saving the reviewed change",
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  const pending = new Event("cancel", { cancelable: true });
  fireEvent(dialog, pending);
  expect(pending.defaultPrevented).toBe(true);
  expect(close).not.toHaveBeenCalled();
  rerender(
    <ConfirmationDialog
      value={confirmation(async () => true)}
      busy={false}
      close={close}
    />,
  );
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(close).toHaveBeenCalledOnce();
});

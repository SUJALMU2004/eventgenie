// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventWizard } from "./wizard";
import { demoEvent } from "@/data/demo";
import { planRepository } from "@/lib/storage/repository";

beforeEach(() => {
  vi.spyOn(planRepository, "loadDraft").mockResolvedValue(undefined);
  vi.spyOn(planRepository, "saveDraft").mockResolvedValue();
  vi.spyOn(planRepository, "findReusable").mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("accessible guided setup", () => {
  it("preselects the event and validates fields before advancing", async () => {
    const user = userEvent.setup();
    render(<EventWizard initialType="birthday" />);
    await screen.findByRole("heading", { name: "What’s the occasion?" });
    expect(screen.getByRole("radio", { name: /Birthday/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("highlighted fields");
    expect(screen.getByLabelText("Event title")).toHaveFocus();
    await user.type(screen.getByLabelText("Event title"), "Meera turns 30");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", {
      name: "Let’s get the essentials right.",
    });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Event title")).toHaveValue("Meera turns 30");
  });
  it("preserves restored details across navigation and review", async () => {
    const user = userEvent.setup();
    vi.mocked(planRepository.loadDraft).mockResolvedValue(
      demoEvent("community"),
    );
    render(<EventWizard />);
    await screen.findByRole("heading", { name: "What’s the occasion?" });
    expect(
      screen.getByRole("radio", { name: /Community event/ }),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(
      screen.getByLabelText("Style or theme (optional)"),
      " with local art",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "One last look before the magic." }),
    ).toBeVisible();
    expect(screen.getByText("Our neighbourhood cultural day")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Edit the essentials" }),
    );
    expect(screen.getByLabelText("City or location")).toHaveValue("Hubballi");
  });
  it("shows generation loading and safe errors without losing inputs", async () => {
    const user = userEvent.setup();
    let rejectFetch: (reason: unknown) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            rejectFetch = reject;
          }),
      ),
    );
    render(<EventWizard sampleType="wedding" />);
    await screen.findByRole("heading", { name: "What’s the occasion?" });
    for (let index = 0; index < 3; index++)
      await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      screen.getByRole("button", { name: "Generate my event plan" }),
    );
    await screen.findByRole("heading", {
      name: "Your celebration is taking shape.",
    });
    expect(
      screen.getByRole("button", { name: "Cancel generation" }),
    ).toBeVisible();
    rejectFetch(new TypeError("private failure"));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private failure");
    expect(screen.getByText("Ananya & Aarav's wedding")).toBeVisible();
  });
  it("reports restricted storage while leaving setup usable", async () => {
    vi.mocked(planRepository.loadDraft).mockRejectedValue(
      new Error("Browser storage is restricted"),
    );
    render(<EventWizard />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Browser storage is restricted",
      ),
    );
    expect(screen.getByLabelText("Event title")).toBeEnabled();
  });
});

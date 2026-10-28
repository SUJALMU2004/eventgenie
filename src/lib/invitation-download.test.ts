// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { downloadText } from "./invitations";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("downloads text locally, removes the link and revokes its object URL", () => {
  vi.useFakeTimers();
  const create = vi.fn((blob: Blob) => {
      expect(blob.type).toBe("text/plain;charset=utf-8");
      return "blob:local-private";
    }),
    revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("invitation.txt");
      expect(this.href).toContain("blob:local-private");
    });
  downloadText("Private invitation text", "invitation.txt");
  expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect(click).toHaveBeenCalledTimes(1);
  expect(document.querySelector("a[download]")).toBeNull();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith("blob:local-private");
});

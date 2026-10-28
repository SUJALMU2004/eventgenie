import type { Workspace } from "./workspace";
import type { VendorQuote } from "@/schemas/finance";
export function saveVendor(
  workspace: Workspace,
  quote: VendorQuote,
): Workspace {
  if (
    workspace.enhancements.quotes.some(
      (item) =>
        item.id !== quote.id &&
        item.category === quote.category &&
        item.displayName.toLocaleLowerCase() ===
          quote.displayName.toLocaleLowerCase(),
    )
  )
    throw new Error(
      "A quote with this name already exists in that category. Edit it instead.",
    );
  const exists = workspace.enhancements.quotes.some(
    (item) => item.id === quote.id,
  );
  return {
    ...workspace,
    enhancements: {
      ...workspace.enhancements,
      quotes: exists
        ? workspace.enhancements.quotes.map((item) =>
            item.id === quote.id ? quote : item,
          )
        : [...workspace.enhancements.quotes, quote],
      cache: [],
    },
  };
}
export function deleteVendor(workspace: Workspace, id: string): Workspace {
  const quote = workspace.enhancements.quotes.find((item) => item.id === id);
  if (!quote) throw new Error("Vendor quote not found");
  if (
    quote.booking === "booked" ||
    workspace.enhancements.expenses.some(
      (expense) => expense.vendorQuoteId === id,
    )
  )
    throw new Error(
      "Unbook this vendor and detach its recorded payments before deleting. Financial obligations must not disappear silently.",
    );
  return {
    ...workspace,
    enhancements: {
      ...workspace.enhancements,
      quotes: workspace.enhancements.quotes.filter((item) => item.id !== id),
      cache: [],
    },
  };
}

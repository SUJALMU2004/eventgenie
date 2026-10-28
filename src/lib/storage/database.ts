import { StorageFailure } from "./errors";
export function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new StorageFailure(
          "UNAVAILABLE",
          "Browser storage is unavailable. Your plan remains open in this tab.",
        ),
      );
  });
}
export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () =>
      reject(
        new StorageFailure(
          "WRITE_FAILED",
          "Could not save in this browser. Storage may be full or restricted. Keep this tab open and retry saving.",
        ),
      );
  });
}

/** Additive upgrades retain every existing store and record. */
export function createDatabase(name: string) {
  async function open(): Promise<IDBDatabase> {
    if (typeof indexedDB === "undefined")
      throw new StorageFailure(
        "UNAVAILABLE",
        "Browser storage is unavailable. Plans can only stay in this tab.",
      );
    try {
      const request = indexedDB.open(name, 3);
      request.onupgradeneeded = () => {
        for (const store of [
          "plans",
          "events",
          "drafts",
          "enhancements",
          "history",
        ])
          if (!request.result.objectStoreNames.contains(store))
            request.result.createObjectStore(store);
      };
      return await new Promise<IDBDatabase>((resolve, reject) => {
        let blocked = false;
        request.onsuccess = () => {
          if (blocked) request.result.close();
          else {
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
          }
        };
        request.onerror = () =>
          reject(
            new StorageFailure(
              "UNAVAILABLE",
              "Browser storage is unavailable. Your plan remains open in this tab.",
            ),
          );
        request.onblocked = () => {
          blocked = true;
          reject(
            new StorageFailure(
              "UNAVAILABLE",
              "Another tab is blocking browser storage. Close other EventGenie tabs and retry saving.",
            ),
          );
        };
      });
    } catch (error) {
      if (error instanceof StorageFailure) throw error;
      throw new StorageFailure(
        "UNAVAILABLE",
        "Browser storage is restricted. Your plan remains in this tab.",
      );
    }
  }

  return { open };
}
export type Database = ReturnType<typeof createDatabase>;
export type StoreName =
  "plans" | "events" | "drafts" | "enhancements" | "history";

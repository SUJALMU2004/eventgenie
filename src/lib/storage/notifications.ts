export const revisionSource = crypto.randomUUID();
/** Cross-tab hints are optional; IndexedDB revision checks enforce correctness. */
export function notifyRevision(planId: string, revision: number) {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined")
    return;
  try {
    const channel = new BroadcastChannel("eventgenie-revisions");
    try {
      channel.postMessage({ planId, revision, source: revisionSource });
    } finally {
      channel.close();
    }
  } catch {
    /* Restricted notification APIs must not turn a committed save into failure. */
  }
}

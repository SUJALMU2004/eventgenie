import { eventSchema, type EventInput } from "@/schemas/event";

export const generationVersion = "eventgenie-v1-prompt1-budget1";
export async function fingerprintData(
  namespace: string,
  data: unknown,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return `${namespace}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
/** Canonical schema order, sorted set-like priorities and a versioned SHA-256 digest. */
export async function inputFingerprint(event: EventInput): Promise<string> {
  const normalized = eventSchema.parse(event);
  normalized.priorities = [...normalized.priorities].sort();
  return fingerprintData(generationVersion, {
    version: generationVersion,
    event: normalized,
  });
}

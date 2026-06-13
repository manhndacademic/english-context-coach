import { createHash } from "node:crypto";

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function hashCanonicalPayload(payload: unknown): string {
  const serialized = JSON.stringify(payload, Object.keys(payload as object).sort());
  return sha256(serialized);
}

import { createHash } from "node:crypto";

export function normalizeSourceText(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

export function normalizePhrase(phrase: string) {
  return phrase
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashCanonicalPayload(payload: unknown) {
  const serialized = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(serialized).digest("hex");
}

export function hashText(content: string) {
  return createHash("sha256").update(normalizeSourceText(content)).digest("hex");
}

export function buildSenseKey(phrase: string, meaningVi: string, category: string) {
  return hashCanonicalPayload({
    category,
    meaningVi: meaningVi.toLowerCase().trim(),
    phrase: normalizePhrase(phrase),
  }).slice(0, 24);
}

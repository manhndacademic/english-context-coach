import { describe, expect, it } from "vitest";
import { buildSenseKey, hashCanonicalPayload, normalizePhrase, normalizeSourceText } from "./text";

describe("text domain helpers", () => {
  it("normalizes source text and phrases", () => {
    expect(normalizeSourceText("  We\n need   this. ")).toBe("We need this.");
    expect(normalizePhrase(" “Push   Back” ")).toBe("push back");
  });

  it("builds stable phrase sense keys", () => {
    expect(buildSenseKey("push back", "dời lại", "phrasal_verb")).toBe(
      buildSenseKey("Push Back", "dời lại", "phrasal_verb"),
    );
  });

  it("hashes canonical payloads", () => {
    expect(hashCanonicalPayload({ a: 1, b: 2 })).toBe(hashCanonicalPayload({ b: 2, a: 1 }));
  });
});

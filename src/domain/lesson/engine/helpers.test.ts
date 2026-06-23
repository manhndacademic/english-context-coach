import { describe, expect, it } from "vitest";
import { isTransientGenerationError } from "./helpers";
import { AiError } from "@/domain/ai/adapters/gemini-utils";

describe("isTransientGenerationError", () => {
  it("should classify standard network/rate-limit errors as transient", () => {
    expect(isTransientGenerationError(new Error("ECONNRESET"))).toBe(true);
    expect(isTransientGenerationError(new Error("Too Many Requests"))).toBe(
      true
    );
    expect(isTransientGenerationError(new Error("RESOURCE_EXHAUSTED"))).toBe(
      true
    );
    expect(isTransientGenerationError(new Error("UNAVAILABLE"))).toBe(true);
  });

  it("should classify AbortError as transient", () => {
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    expect(isTransientGenerationError(abortErr)).toBe(true);
  });

  it("should classify AiError timeout as transient", () => {
    const timeoutErr = new AiError(
      "Gemini API request timed out after 60000ms",
      "timeout"
    );
    expect(isTransientGenerationError(timeoutErr)).toBe(true);
  });

  it("should not classify general errors as transient", () => {
    expect(
      isTransientGenerationError(new Error("Some random database error"))
    ).toBe(false);
    expect(isTransientGenerationError("some string error")).toBe(false);
  });
});

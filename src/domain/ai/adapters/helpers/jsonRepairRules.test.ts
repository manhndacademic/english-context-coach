import { describe, expect, it } from "vitest";
import { repairJson } from "./jsonRepairRules";

describe("jsonRepairRules", () => {
  it("should strip trailing commas outside strings", () => {
    const raw = '{"a": 1, "b": 2, }';
    expect(repairJson(raw)).toBe('{"a": 1, "b": 2 }');
  });

  it("should keep trailing commas inside strings", () => {
    const raw = '{"a": "hello, "}';
    expect(repairJson(raw)).toBe('{"a": "hello, "}');
  });

  it("should escape control character newlines inside strings", () => {
    const raw = '{"a": "line 1\nline 2"}';
    expect(repairJson(raw)).toBe('{"a": "line 1\\nline 2"}');
  });

  it("should escape internal unescaped quotes inside strings", () => {
    const raw = '{"a": "user said "hello" to me"}';
    expect(repairJson(raw)).toBe('{"a": "user said \\"hello\\" to me"}');
  });
});

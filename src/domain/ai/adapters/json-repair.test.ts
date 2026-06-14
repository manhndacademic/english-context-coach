import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { gradingSchema } from "@/lib/ai/schemas";
import { JsonRepairStrategy } from "./json-repair";

const validGrading = {
  score: 80,
  isCorrect: true,
  feedbackVi: "Ổn rồi.",
  naturalAnswer: "Đây là một cách hiểu tự nhiên trong ngữ cảnh.",
  literalTranslationTrap: null,
  feedbackDetails: null,
  error: null,
};

describe("JsonRepairStrategy", () => {
  it("repairs a parse-failed raw response before retrying the original prompt", async () => {
    const strategy = new JsonRepairStrategy();
    const callGemini = vi
      .fn()
      .mockResolvedValueOnce({
        text: '{"score":80,"isCorrect":true,"feedbackVi":"ok","naturalAnswer":"...',
        inputTokens: 10,
        outputTokens: 20,
        model: "main-model",
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(validGrading),
        inputTokens: 30,
        outputTokens: 40,
        model: "repair-model",
      });

    const result = await strategy.execute(
      {
        purpose: "grading",
        prompt: "ORIGINAL GRADING PROMPT",
        schemaVersion: "grading",
        schema: gradingSchema,
        modelKind: "analysis",
      },
      callGemini
    );

    expect(result.data).toMatchObject({ score: 80, isCorrect: true });
    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(callGemini.mock.calls[0][0]).toBe("ORIGINAL GRADING PROMPT");
    expect(callGemini.mock.calls[1][0]).toContain(
      "Repair this grading response"
    );
    expect(callGemini.mock.calls[1][0]).not.toBe("ORIGINAL GRADING PROMPT");
  });

  it("adds token accounting from the original request and repair request", async () => {
    const strategy = new JsonRepairStrategy();
    const callGemini = vi
      .fn()
      .mockResolvedValueOnce({
        text: '{"score":80,"isCorrect":true,"feedbackVi":"ok","naturalAnswer":"...',
        inputTokens: 11,
        outputTokens: 22,
        model: "main-model",
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(validGrading),
        inputTokens: 33,
        outputTokens: 44,
        model: "repair-model",
      });

    const result = await strategy.execute(
      {
        purpose: "grading",
        prompt: "ORIGINAL GRADING PROMPT",
        schemaVersion: "grading",
        schema: gradingSchema,
        modelKind: "analysis",
      },
      callGemini
    );

    expect(result.inputTokens).toBe(44);
    expect(result.outputTokens).toBe(66);
    expect(result.model).toBe("repair-model");
  });

  it("does not enable thoughts for grading main requests", async () => {
    const strategy = new JsonRepairStrategy();
    const callGemini = vi.fn().mockResolvedValueOnce({
      text: JSON.stringify(validGrading),
      inputTokens: 10,
      outputTokens: 20,
      model: "main-model",
    });

    await strategy.execute(
      {
        purpose: "grading",
        prompt: "ORIGINAL GRADING PROMPT",
        schemaVersion: "grading",
        schema: gradingSchema,
        modelKind: "analysis",
      },
      callGemini
    );

    expect(callGemini.mock.calls[0][1]).toBe(false);
  });

  it("keeps thoughts enabled for non-grading main requests", async () => {
    const strategy = new JsonRepairStrategy();
    const schema = z.object({ value: z.string() });
    const callGemini = vi.fn().mockResolvedValueOnce({
      text: JSON.stringify({ value: "ok" }),
      inputTokens: 10,
      outputTokens: 20,
      model: "main-model",
    });

    await strategy.execute(
      {
        purpose: "analysis",
        prompt: "ORIGINAL ANALYSIS PROMPT",
        schemaVersion: "analysis",
        schema,
        modelKind: "analysis",
      },
      callGemini
    );

    expect(callGemini.mock.calls[0][1]).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { GeminiGenerationEngine } from "./gemini-generation";
import type { LLMProvider } from "@/domain/ai";
import { WritingCoachPrompt } from "../prompts";

describe("GeminiGenerationEngine - generateWritingCoachAnalysis", () => {
  it("should generate analysis, calculate diffs, and map corrections properly", async () => {
    const mockResponse = {
      title: "Lesson Title",
      documentType: "email",
      formality: "formal",
      suggestedText: "I am writing to check the status.",
      detectedLevel: "B2",
      summaryVi: "Tóm tắt",
      naturalTranslationVi: "Dịch tự nhiên",
      contextExplanationVi: "Giải thích ngữ cảnh",
      toneAnalysisVi: "Phân tích giọng điệu",
      corrections: [
        {
          draftPhrase: "check state",
          correctedPhrase: "check the status",
          explanationVi: "Nên dùng status trong ngữ cảnh này.",
          literalTrapVi: null,
          culturalNoteVi:
            "Trong email trang trọng, check the status lịch sự hơn.",
          exampleEn: "Could you check the status?",
          exampleVi: "Bạn có thể kiểm tra trạng thái không?",
          category: "general_phrase",
          errorType: "collocation_error",
        },
      ],
    };

    const mockLlm = {
      generateJson: vi.fn().mockResolvedValue(mockResponse),
      generateText: vi.fn(),
    } as unknown as LLMProvider;

    const engine = new GeminiGenerationEngine(mockLlm, "user-1", "lesson-1");
    const result = await engine.generateWritingCoachAnalysis(
      "I write to check state."
    );

    expect(mockLlm.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        lessonId: "lesson-1",
        prompt: expect.any(WritingCoachPrompt),
      })
    );

    expect(result.title).toBe("Lesson Title");
    expect(result.textType).toBe("email");
    expect(result.formality).toBe("formal");
    expect(result.suggestedText).toBe("I am writing to check the status.");
    expect(result.detectedLevel).toBe("B2");
    expect(result.summaryVi).toBe("Tóm tắt");
    expect(result.naturalTranslationVi).toBe("Dịch tự nhiên");
    expect(result.contextExplanationVi).toBe("Giải thích ngữ cảnh");
    expect(result.correctionItems).toHaveLength(1);

    const firstCorrection = result.correctionItems![0];
    expect(firstCorrection.draftPhrase).toBe("check state");
    expect(firstCorrection.correctedPhrase).toBe("check the status");
    expect(firstCorrection.culturalNoteVi).toBe(
      "Trong email trang trọng, check the status lịch sự hơn."
    );
  });
});

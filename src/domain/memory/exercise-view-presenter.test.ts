import { describe, expect, it } from "vitest";
import {
  getExerciseStatusView,
  getExerciseTypeLabel,
  getExercisePlaceholder,
  getChoiceStyle,
} from "./exercise-view-presenter";

describe("exercise-view-presenter", () => {
  describe("getExerciseStatusView", () => {
    it("should return the correct configuration for 'solved'", () => {
      expect(getExerciseStatusView("solved")).toEqual({
        label: "Đã xong",
        className: "bg-success-light border-success text-success",
        iconType: "solved",
      });
    });

    it("should return the correct configuration for 'needs-retry'", () => {
      expect(getExerciseStatusView("needs-retry")).toEqual({
        label: "Cần thử lại",
        className: "bg-danger-light border-danger text-danger",
        iconType: "retry",
      });
    });

    it("should return the correct configuration for 'current'", () => {
      expect(getExerciseStatusView("current")).toEqual({
        label: "Lượt tiếp theo",
        className: "bg-surface-strong border-border text-muted",
        iconType: "target",
      });
    });

    it("should return the correct configuration for 'upcoming'", () => {
      expect(getExerciseStatusView("upcoming")).toEqual({
        label: "Chưa bắt đầu",
        className: "bg-surface-strong border-border text-muted",
        iconType: "target",
      });
    });
  });

  describe("getExerciseTypeLabel", () => {
    it("should map known exercise types correctly", () => {
      expect(getExerciseTypeLabel("meaning_choice")).toBe("Trắc nghiệm nghĩa");
      expect(getExerciseTypeLabel("cloze_phrase")).toBe("Điền từ vào ô trống");
      expect(getExerciseTypeLabel("natural_translation")).toBe(
        "Dịch sang tiếng Việt"
      );
      expect(getExerciseTypeLabel("focus_question")).toBe("Câu hỏi trọng tâm");
      expect(getExerciseTypeLabel("trap_choice")).toBe("Tránh bẫy dịch");
      expect(getExerciseTypeLabel("phrase_production")).toBe(
        "Đặt câu tiếng Anh"
      );
      expect(getExerciseTypeLabel("dialogue_completion")).toBe(
        "Hoàn thành hội thoại"
      );
      expect(getExerciseTypeLabel("register_shift")).toBe(
        "Viết lại tự nhiên hơn"
      );
      expect(getExerciseTypeLabel("trap_detect")).toBe("Phát hiện bẫy dịch");
    });

    it("should map unknown exercise types to fallback label", () => {
      expect(getExerciseTypeLabel("unknown_type")).toBe("Luyện tập");
    });
  });

  describe("getExercisePlaceholder", () => {
    it("should return retry placeholder when needsRetry is true", () => {
      expect(getExercisePlaceholder("cloze_phrase", true)).toBe("Thử lại...");
      expect(getExercisePlaceholder("natural_translation", true)).toBe(
        "Thử lại..."
      );
    });

    it("should return type-specific placeholders when needsRetry is false", () => {
      expect(getExercisePlaceholder("cloze_phrase", false)).toBe(
        "Điền từ hoặc cụm từ phù hợp vào chỗ trống..."
      );
      expect(getExercisePlaceholder("phrase_production", false)).toBe(
        "Viết câu tiếng Anh hoàn chỉnh chứa cụm từ..."
      );
      expect(getExercisePlaceholder("dialogue_completion", false)).toBe(
        "Viết câu phản hồi tiếng Anh của B có chứa cụm từ..."
      );
      expect(getExercisePlaceholder("register_shift", false)).toBe(
        "Viết lại câu tiếng Anh tự nhiên/idiomatic hơn..."
      );
      expect(getExercisePlaceholder("natural_translation", false)).toBe(
        "Viết câu dịch hoặc câu trả lời tiếng Việt tự nhiên của bạn..."
      );
    });
  });

  describe("getChoiceStyle", () => {
    it("should return success styles if solved, not practicing again, and is the correct choice", () => {
      const style = getChoiceStyle({
        choice: "A",
        answer: "A",
        solved: true,
        isPracticingAgain: false,
        isCorrectChoice: true,
      });
      expect(style).toBe(
        "bg-success-light border-success text-success font-semibold"
      );
    });

    it("should return active selected styles if the user selected this choice", () => {
      const style = getChoiceStyle({
        choice: "A",
        answer: "A",
        solved: false,
        isPracticingAgain: false,
        isCorrectChoice: false,
      });
      expect(style).toBe(
        "border-accent bg-accent-light/30 ring-2 ring-accent/30 font-medium"
      );
    });

    it("should return active selected styles even if solved but the user is practicing again", () => {
      const style = getChoiceStyle({
        choice: "A",
        answer: "A",
        solved: true,
        isPracticingAgain: true,
        isCorrectChoice: true,
      });
      expect(style).toBe(
        "border-accent bg-accent-light/30 ring-2 ring-accent/30 font-medium"
      );
    });

    it("should return default styling if not selected or correct solved", () => {
      const style = getChoiceStyle({
        choice: "B",
        answer: "A",
        solved: false,
        isPracticingAgain: false,
        isCorrectChoice: false,
      });
      expect(style).toBe("border-border hover:bg-surface-active");
    });
  });
});

import type { ExercisePracticeStatus } from "@/domain/types";

export type ExerciseStatus = "solved" | "needs-retry" | "current" | "upcoming";

export interface ExerciseStatusView {
  label: string;
  className: string;
  iconType: ExercisePracticeStatus;
}

export function getExerciseStatusView(
  status: ExerciseStatus
): ExerciseStatusView {
  switch (status) {
    case "solved":
      return {
        label: "Đã xong",
        className: "bg-success-light border-success text-success",
        iconType: "solved",
      };
    case "needs-retry":
      return {
        label: "Cần thử lại",
        className: "bg-danger-light border-danger text-danger",
        iconType: "retry",
      };
    case "current":
      return {
        label: "Lượt tiếp theo",
        className: "bg-surface-strong border-border text-muted",
        iconType: "target",
      };
    case "upcoming":
    default:
      return {
        label: "Chưa bắt đầu",
        className: "bg-surface-strong border-border text-muted",
        iconType: "target",
      };
  }
}

export function getExerciseTypeLabel(type: string): string {
  switch (type) {
    case "meaning_choice":
      return "Trắc nghiệm nghĩa";
    case "cloze_phrase":
      return "Điền từ vào ô trống";
    case "natural_translation":
      return "Dịch sang tiếng Việt";
    case "focus_question":
      return "Câu hỏi trọng tâm";
    case "trap_choice":
      return "Tránh bẫy dịch";
    case "phrase_production":
      return "Đặt câu tiếng Anh";
    case "dialogue_completion":
      return "Hoàn thành hội thoại";
    case "register_shift":
      return "Viết lại tự nhiên hơn";
    case "trap_detect":
      return "Phát hiện bẫy dịch";
    default:
      return "Luyện tập";
  }
}

export function getExercisePlaceholder(
  type: string,
  needsRetry: boolean
): string {
  if (needsRetry) {
    return "Thử lại...";
  }
  switch (type) {
    case "cloze_phrase":
      return "Điền từ hoặc cụm từ phù hợp vào chỗ trống...";
    case "phrase_production":
      return "Viết câu tiếng Anh hoàn chỉnh chứa cụm từ...";
    case "dialogue_completion":
      return "Viết câu phản hồi tiếng Anh của B có chứa cụm từ...";
    case "register_shift":
      return "Viết lại câu tiếng Anh tự nhiên/idiomatic hơn...";
    case "natural_translation":
    case "focus_question":
    default:
      return "Viết câu dịch hoặc câu trả lời tiếng Việt tự nhiên của bạn...";
  }
}

export interface ChoiceStyleInput {
  choice: string;
  answer: string;
  solved: boolean;
  isPracticingAgain: boolean;
  isCorrectChoice: boolean;
}

export function getChoiceStyle(input: ChoiceStyleInput): string {
  const { choice, answer, solved, isPracticingAgain, isCorrectChoice } = input;

  if (solved && !isPracticingAgain && isCorrectChoice) {
    return "bg-success-light border-success text-success font-semibold";
  }

  if (answer === choice) {
    return "border-accent bg-accent-light/30 ring-2 ring-accent/30 font-medium";
  }

  return "border-border hover:bg-surface-active";
}

export type StepperItemState = "solved" | "needs-retry" | "pending";
export type StepperItemActiveState = "active" | "inactive";

export interface StepperItemView {
  className: string;
  iconType: ExercisePracticeStatus;
}

export function getStepperItemView(
  state: StepperItemState,
  activeState: StepperItemActiveState
): StepperItemView {
  const baseClass =
    "relative flex items-center justify-center gap-1.5 px-3.5 h-[38px] rounded-md cursor-pointer transition-all duration-200 font-bold text-xs hover:-translate-y-px hover:border-accent hover:bg-surface-strong border";

  let classNameSuffix = "";
  if (activeState === "active") {
    classNameSuffix =
      "border-accent text-accent-strong ring-3 ring-accent-light bg-surface";
  } else {
    switch (state) {
      case "solved":
        classNameSuffix =
          "bg-success-light border-success/30 text-success-strong";
        break;
      case "needs-retry":
        classNameSuffix =
          "bg-warning-light border-warning/30 text-warning-strong";
        break;
      case "pending":
      default:
        classNameSuffix = "bg-surface border-border text-muted";
        break;
    }
  }

  let iconType: ExercisePracticeStatus = "target";
  switch (state) {
    case "solved":
      iconType = "solved";
      break;
    case "needs-retry":
      iconType = "retry";
      break;
    case "pending":
    default:
      iconType = "target";
      break;
  }

  return {
    className: `${baseClass} ${classNameSuffix}`,
    iconType,
  };
}

import { ExerciseStepper } from "@/components/exercise-stepper";

interface ExercisePanelProps {
  lesson: {
    id: string;
    exerciseStatus: string;
  };
  exercises: any[];
  stepperItems: any[];
  serializedMistakePatterns: Record<string, any>;
  serializedUserErrors: Record<string, any>;
}

export function ExercisePanel({
  lesson,
  exercises,
  stepperItems,
  serializedMistakePatterns,
  serializedUserErrors,
}: ExercisePanelProps) {
  if (!exercises.length && lesson.exerciseStatus !== "running") {
    return null;
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text m-0">
            Luyện tập thực hành
          </h2>
          {exercises.length ? (
            <p className="text-xs text-muted leading-relaxed m-0 mt-1">
              Tập trung dịch sát nghĩa tự nhiên theo ngữ cảnh, tránh bẫy dịch
              từng từ.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        {exercises.length ? (
          <ExerciseStepper
            items={stepperItems}
            serializedMistakePatterns={serializedMistakePatterns}
            serializedUserErrors={serializedUserErrors}
          />
        ) : (
          <p className="text-muted text-sm leading-relaxed m-0">
            {lesson.exerciseStatus === "failed"
              ? "Tạo bài tập thất bại. Hãy chọn thử lại sau khi phân tích hoàn tất."
              : "Bài tập thực hành đang được tạo tự động..."}
          </p>
        )}
      </div>
    </section>
  );
}

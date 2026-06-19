import { ExerciseStepper } from "@/components/exercise-stepper";

interface ExercisePanelProps {
  lesson: {
    id: string;
    exerciseStatus: string;
  };
  practices: any[];
}

export function ExercisePanel({ lesson, practices }: ExercisePanelProps) {
  if (!practices.length && lesson.exerciseStatus !== "running") {
    return null;
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text m-0">
            Luyện tập thực hành
          </h2>
          {practices.length ? (
            <p className="text-xs text-muted leading-relaxed m-0 mt-1">
              Tập trung dịch sát nghĩa tự nhiên theo ngữ cảnh, tránh bẫy dịch
              từng từ.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        {practices.length ? (
          <ExerciseStepper practices={practices} />
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

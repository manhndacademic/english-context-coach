import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { getLessonRepository } from "@/domain/lesson";
import { classifyInputMode } from "./lesson-view-model";
import { StandardLessonLayout } from "@/components/lesson/StandardLessonLayout";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const lessonData = await getLessonRepository().getLessonAggregate(
    id,
    user.id
  );
  if (!lessonData) notFound();

  const { lesson } = lessonData;
  const { isNotEnglishOrUnsupported } = classifyInputMode(lesson.inputMode);

  if (isNotEnglishOrUnsupported) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
        <AppHeader email={user.email} isAdmin={user.role === "admin"} />
        <section className="border-l-4 border-warning bg-warning-light p-6 rounded-lg grid gap-5 border border-y-border border-r-border shadow-md">
          <div className="flex flex-wrap items-center gap-2 text-warning font-bold text-lg">
            <AlertCircle size={22} />
            <span>
              Phân tích không khả dụng:{" "}
              {lesson.inputMode === "not_english"
                ? "Văn bản không phải tiếng Anh"
                : "Văn bản không được hỗ trợ"}
            </span>
          </div>
          <p className="mt-3 text-base leading-relaxed text-text">
            {lesson.summaryVi ||
              "Hệ thống chỉ hỗ trợ phân tích các đoạn văn bản tiếng Anh phục vụ cho học tập hoặc công việc."}
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] h-10"
            >
              Quay lại bảng điều khiển
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <StandardLessonLayout
      user={{ email: user.email, role: user.role }}
      lessonData={lessonData}
      now={now}
    />
  );
}

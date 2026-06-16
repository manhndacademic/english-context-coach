import { History, Target, TrendingDown, Trophy } from "lucide-react";

const metrics = [
  {
    label: "Lỗi dịch từng chữ giảm 32%",
    detail: "So với các bài tập đầu tiên",
    icon: TrendingDown,
  },
  {
    label: "18 mẫu lỗi đã nắm vững",
    detail: "Phrasal verbs, tone, collocations",
    icon: Trophy,
  },
  {
    label: "7 ngày ôn tập liên tiếp",
    detail: "Ôn đúng lúc lỗi sắp bị quên",
    icon: History,
  },
  {
    label: "Top lỗi lặp lại: phrasal verbs",
    detail: "Trong ngữ cảnh công việc",
    icon: Target,
  },
];

export function MistakeMemorySection() {
  return (
    <section className="mb-20 grid gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6 items-center">
        <div className="grid gap-4">
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold">
            Mistake Memory
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold m-0 text-text">
            App học từ lỗi sai của bạn.
          </h2>
          <p className="text-sm md:text-base text-muted leading-relaxed m-0">
            Mỗi lần bạn hiểu nhầm một cụm từ, dịch sai một câu hoặc chọn sai
            đáp án, app lưu lại pattern đó. Sau đó, app nhắc lại vào đúng thời
            điểm để bạn nhớ lâu hơn.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg shadow-md overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-strong px-5 py-3">
            <strong className="text-sm text-text">Ví dụ tiến độ</strong>
            <span className="rounded-full bg-accent-light border border-border-glow px-2.5 py-1 text-xs font-bold text-accent">
              Demo dashboard
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="rounded-md border border-border bg-surface-strong p-4 grid gap-2"
                >
                  <Icon size={18} className="text-accent" />
                  <strong className="text-sm text-text">{metric.label}</strong>
                  <span className="text-xs leading-relaxed text-muted">
                    {metric.detail}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

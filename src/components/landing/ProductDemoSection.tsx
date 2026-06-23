import {
  BookOpenCheck,
  ClipboardList,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";

export function ProductDemoSection() {
  return (
    <section className="mb-20 grid gap-8">
      <div className="text-center max-w-170 mx-auto">
        <Badge variant="default" size="sm" className="mb-3">
          Demo bài học
        </Badge>
        <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
          Dán một đoạn tiếng Anh thật. Nhận một bài học cá nhân hóa.
        </h2>
        <p className="text-sm md:text-base text-muted leading-relaxed">
          Không cần tự nghĩ prompt. App tự phân tích đoạn bạn dán, giải thích
          nghĩa thật, chỉ ra cụm dễ hiểu nhầm và tạo bài tập để bạn luyện ngay.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-5 lg:gap-6 items-stretch">
        <SectionCard className="p-5 md:p-6 shadow-md content-start gap-4">
          <Badge variant="accent" size="sm" className="w-fit">
            Input
          </Badge>
          <p className="font-serif text-xl md:text-2xl leading-relaxed text-accent-strong m-0">
            &quot;We need to push this back because the API change is not
            backward compatible.&quot;
          </p>
          <p className="text-sm leading-relaxed text-muted m-0">
            Một câu giống những gì bạn gặp trong GitHub issue, changelog hoặc
            Slack khi làm việc với team quốc tế.
          </p>
        </SectionCard>

        <SectionCard className="p-0 sm:p-0 shadow-md overflow-hidden gap-0">
          <div className="border-b border-border bg-surface-strong px-5 py-3">
            <strong className="text-sm text-text">App output</strong>
          </div>
          <div className="p-5 md:p-6 grid gap-4">
            <div className="grid gap-2 rounded-md border border-border bg-surface-strong p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-text">
                <BookOpenCheck size={17} className="text-accent" />
                Nghĩa tự nhiên
              </div>
              <p className="m-0 text-sm leading-relaxed text-text">
                Chúng ta cần dời việc này lại vì thay đổi API không tương thích
                ngược.
              </p>
            </div>

            <div className="grid gap-2 rounded-md border border-danger/20 bg-danger-light p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-danger">
                <TriangleAlert size={17} />
                Bẫy dịch từng chữ
              </div>
              <ul className="m-0 pl-5 grid gap-1.5 text-sm leading-relaxed text-text">
                <li>
                  push this back không phải là &quot;đẩy cái này ra sau&quot;
                </li>
                <li>
                  backward compatible không phải là &quot;tương thích phía
                  sau&quot;
                </li>
              </ul>
            </div>

            <div className="grid gap-2 rounded-md border border-border bg-surface-strong p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-text">
                <Lightbulb size={17} className="text-warning" />
                Cụm nên nhớ
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text">
                  push back = hoãn / dời lịch
                </span>
                <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text">
                  backward compatible = tương thích ngược
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-md border border-success/20 bg-success-light p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-success">
                <ClipboardList size={17} />
                Bài tập
              </div>
              <p className="m-0 text-sm leading-relaxed text-text">
                Dịch câu sau theo ngữ cảnh công việc:
              </p>
              <p className="m-0 font-serif text-base text-accent-strong">
                &quot;Can we push the release back to next Monday?&quot;
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

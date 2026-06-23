import { AlertCircle } from "lucide-react";
import { retryReviewPromptGenerationAction } from "@/app/actions/review";
import { RepeatedMistakeStatus } from "@/components/dashboard/repeated-mistake-status";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";

interface RepeatedMistakesPanelProps {
  repeatedMistakes: Array<{
    id: string;
    normalizedPhrase: string;
    occurrenceCount: number;
    meaningVi: string;
    errorType: string;
    reviewPromptStatus: string;
    dueAt?: string | Date;
  }>;
}

export function RepeatedMistakesPanel({
  repeatedMistakes,
}: RepeatedMistakesPanelProps) {
  return (
    <SectionCard className="p-5 sm:p-8 gap-3.5">
      <SectionCard.Header
        title="Mẫu lỗi lặp lại nổi bật"
        icon={<AlertCircle size={18} className="text-muted" />}
      />
      <SectionCard.Body>
        <div className="grid divide-y divide-border">
          {repeatedMistakes.length ? (
            repeatedMistakes.map((pattern) => (
              <div
                className="py-3 flex flex-col gap-1.5 first:pt-0 last:pb-0"
                key={pattern.id}
              >
                <div className="flex justify-between items-center gap-2">
                  <strong className="text-accent-strong text-[15px] font-bold">
                    {pattern.normalizedPhrase}
                  </strong>
                  <Badge
                    variant="default"
                    size="sm"
                    className="px-2 py-0.5 text-[10px] font-extrabold leading-none"
                  >
                    Gặp {pattern.occurrenceCount} lần
                  </Badge>
                </div>
                <span className="text-muted text-sm leading-relaxed">
                  Nghĩa đúng: {pattern.meaningVi}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    variant="danger"
                    size="sm"
                    className="px-2 py-0.5 text-[10px] font-extrabold leading-none"
                  >
                    {pattern.errorType.replaceAll("_", " ")}
                  </Badge>
                  <RepeatedMistakeStatus
                    patternId={pattern.id}
                    reviewPromptStatus={pattern.reviewPromptStatus}
                    dueAt={pattern.dueAt}
                    retryAction={retryReviewPromptGenerationAction}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted text-sm leading-relaxed m-0 pt-2">
              Các mẫu lỗi sai lặp lại sẽ xuất hiện ở đây sau khi bạn làm bài tập
              và tích lũy bộ nhớ lỗi.
            </p>
          )}
        </div>
      </SectionCard.Body>
    </SectionCard>
  );
}

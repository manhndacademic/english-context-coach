import { SourceMeaningPanel } from "./SourceMeaningPanel";
import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";
import { ReadableSourceText } from "@/components/readable-source-text";
import type { KeyPhrase } from "@/domain/lesson";

interface MixedLanguageViewProps {
  lesson: {
    id: string;
    summaryVi: string | null;
    naturalTranslationVi: string | null;
    contextExplanationVi: string | null;
  };
  sourceContent: string | null;
  phrases: KeyPhrase[];
  sentenceBreakdowns: any[];
  lessonFocuses: any[];
}

export function MixedLanguageView({
  lesson,
  sourceContent,
  phrases,
  sentenceBreakdowns,
  lessonFocuses,
}: MixedLanguageViewProps) {
  return (
    <>
      {sourceContent ? (
        <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
          <div className="flex flex-col min-[860px]:flex-row min-[860px]:items-baseline gap-2">
            <h2 className="text-2xl font-bold text-text m-0">
              Văn bản gốc (Source)
            </h2>
            <span className="text-xs text-muted">
              Nhấp vào từ/cụm từ tô màu để xem giải nghĩa bên phải.
            </span>
          </div>
          <div className="border border-border rounded-md p-6 bg-surface font-serif text-[17px] md:text-lg leading-relaxed overflow-y-auto max-h-[340px] min-[860px]:max-h-[500px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.03)] text-text space-y-3 [&_h3]:text-lg [&_h3]:font-bold [&_blockquote]:border-l-3 [&_blockquote]:border-accent [&_blockquote]:pl-3.5 [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_pre]:bg-surface-strong [&_pre]:p-3 [&_pre]:whitespace-pre-wrap">
            <ReadableSourceText
              key={`${lesson.id}-${phrases.map((p) => p.id).join(",")}`}
              doc={sourceContent}
              phrases={phrases}
              lessonId={lesson.id}
            />
          </div>
        </section>
      ) : null}

      <SourceMeaningPanel
        mode="standard"
        lesson={lesson}
        lessonFocuses={lessonFocuses}
      />

      {sentenceBreakdowns.length > 0 && (
        <SentenceBreakdownPanel
          sentenceBreakdowns={sentenceBreakdowns}
          mode="standard"
        />
      )}
    </>
  );
}

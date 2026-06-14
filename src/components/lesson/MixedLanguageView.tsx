import { SourceMeaningPanel } from "./SourceMeaningPanel";
import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";

interface MixedLanguageViewProps {
  lesson: {
    summaryVi: string | null;
    naturalTranslationVi: string | null;
    contextExplanationVi: string | null;
  };
  sentenceBreakdowns: any[];
  lessonFocuses: any[];
}

export function MixedLanguageView({
  lesson,
  sentenceBreakdowns,
  lessonFocuses,
}: MixedLanguageViewProps) {
  return (
    <>
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

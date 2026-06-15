import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";
import { SourceMeaningPanel } from "./SourceMeaningPanel";
import type { DiffSpan } from "@/lib/ai/schemas";

interface GrammarCorrectionViewProps {
  lesson: {
    summaryVi: string | null;
    naturalTranslationVi: string | null;
    contextExplanationVi: string | null;
  };
  sentenceBreakdowns: Array<{
    id: string;
    sentence: string;
    correctedSentenceEn: string | null;
    diffSpans?: DiffSpan[] | null;
    naturalMeaningVi: string;
    structureNotesVi: string;
    toneOrContextVi: string | null;
  }>;
  lessonFocuses: Array<{
    id: string;
    title: string;
    explanationVi: string;
    category: string;
    difficulty: string;
  }>;
}

export function GrammarCorrectionView({
  lesson,
  sentenceBreakdowns,
  lessonFocuses,
}: GrammarCorrectionViewProps) {
  return (
    <>
      <SentenceBreakdownPanel sentenceBreakdowns={sentenceBreakdowns} />
      <SourceMeaningPanel
        mode="grammar"
        lesson={lesson}
        lessonFocuses={lessonFocuses}
      />
    </>
  );
}

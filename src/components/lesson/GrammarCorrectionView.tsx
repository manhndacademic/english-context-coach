import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";
import { SourceMeaningPanel } from "./SourceMeaningPanel";

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

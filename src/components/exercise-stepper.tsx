"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Target,
  Sparkles,
} from "lucide-react";
import { ExerciseCard } from "./exercise-card";
import type { Exercise, KeyPhrase, LessonFocus } from "@/domain/lesson";
import type { Attempt } from "@/domain/memory";
import { Button } from "@/components/ui/button";
import { CompletionSummary } from "@/components/completion-summary";
import {
  buildCompletionStats,
  type CompletionStats,
  type CompletionMistakePatternSummary,
  type CompletionUserErrorSummary,
} from "@/components/completion-summary-stats";

interface ExerciseItem {
  exercise: Exercise;
  attempts: Attempt[];
  isSolved: boolean;
  needsRetry: boolean;
  keyPhrase?: KeyPhrase;
  lessonFocus?: LessonFocus;
}

export function ExerciseStepper({
  items,
  serializedMistakePatterns,
  serializedUserErrors,
}: {
  items: ExerciseItem[];
  serializedMistakePatterns: Record<string, CompletionMistakePatternSummary>;
  serializedUserErrors: Record<string, any>;
}) {
  // Find the first unsolved exercise index to focus on initially
  const initialIndex = useMemo(() => {
    const firstUnsolved = items.findIndex((item) => !item.isSolved);
    return firstUnsolved === -1 ? 0 : firstUnsolved;
  }, [items]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // Track whether the user dismissed the CompletionSummary to redo exercises
  const [showSummary, setShowSummary] = useState(true);

  // Clamp index if items change or if it is out of bounds
  const currentIndex =
    activeIndex >= items.length ? Math.max(0, items.length - 1) : activeIndex;

  const userErrorsMap = useMemo(() => {
    return new Map(Object.entries(serializedUserErrors)) as Map<
      string,
      CompletionUserErrorSummary
    >;
  }, [serializedUserErrors]);

  const mistakePatternsMap = useMemo(() => {
    return new Map(Object.entries(serializedMistakePatterns));
  }, [serializedMistakePatterns]);

  const activeItem = items[currentIndex];
  const total = items.length;
  const solvedCount = items.filter((item) => item.isSolved).length;
  const allSolved = solvedCount === total;

  // Derive CompletionStats from server-rendered data (attempts + userErrors)
  const completionStats = useMemo<CompletionStats>(() => {
    return buildCompletionStats({
      items,
      userErrorsByAttemptId: userErrorsMap,
      mistakePatternsByKey: mistakePatternsMap,
    });
  }, [items, mistakePatternsMap, userErrorsMap]);

  const handleRetry = useCallback(() => {
    setActiveIndex(0);
    setShowSummary(false);
  }, []);

  if (!items.length) {
    return null;
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setActiveIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setActiveIndex(currentIndex + 1);
    }
  };

  // Show CompletionSummary when all exercises are solved and user hasn't dismissed
  if (allSolved && showSummary) {
    return <CompletionSummary stats={completionStats} onRetry={handleRetry} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stepper Progress bar */}
      <div className="flex flex-col gap-3 bg-surface-strong p-3.5 px-4 rounded-md border border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text">
            Bài tập <strong className="font-bold">{currentIndex + 1}</strong> /{" "}
            {total}
          </span>
          {allSolved ? (
            <span className="inline-flex items-center gap-1 text-success text-xs sm:text-sm font-bold">
              <Sparkles size={14} /> Hoàn thành tất cả
            </span>
          ) : (
            <span className="text-xs sm:text-sm text-muted font-semibold">
              Đã xong {solvedCount}/{total}
            </span>
          )}
        </div>

        {/* Stepper Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {items.map((item, idx) => {
            let dotClass =
              "relative flex items-center justify-center gap-1.5 px-3.5 h-[38px] rounded-md cursor-pointer transition-all duration-200 font-bold text-xs hover:-translate-y-px hover:border-accent hover:bg-surface-strong border ";
            let icon = null;

            if (idx === currentIndex) {
              dotClass +=
                "border-accent text-accent-strong ring-3 ring-accent-light bg-surface ";
            } else if (item.isSolved) {
              dotClass +=
                "bg-success-light border-success/30 text-success-strong ";
            } else if (item.needsRetry) {
              dotClass +=
                "bg-warning-light border-warning/30 text-warning-strong ";
            } else {
              dotClass += "bg-surface border-border text-muted ";
            }

            if (item.isSolved) {
              icon = <CheckCircle2 size={13} className="shrink-0" />;
            } else if (item.needsRetry) {
              icon = <AlertCircle size={13} className="shrink-0" />;
            } else {
              icon = <Target size={13} className="shrink-0 text-muted/60" />;
            }

            return (
              <button
                key={item.exercise.id}
                className={dotClass}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Đi tới bài tập ${idx + 1}`}
                title={`Bài tập ${idx + 1}: ${item.isSolved ? "Đã xong" : item.needsRetry ? "Cần sửa lại" : "Chưa làm"}`}
              >
                <span>Câu {idx + 1}</span>
                {icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Active Exercise Card */}
      <div className="animate-in fade-in slide-in-from-bottom-1.5 duration-200">
        <ExerciseCard
          key={activeItem.exercise.id}
          attempts={activeItem.attempts}
          exercise={activeItem.exercise}
          isCurrent={true}
          keyPhrase={activeItem.keyPhrase}
          lessonFocus={activeItem.lessonFocus}
          userErrorsByAttemptId={userErrorsMap}
        />
      </div>

      {/* Bottom Stepper Controls */}
      <div className="flex items-center justify-between gap-3 mt-1">
        <Button
          variant="secondary"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="px-4 py-2.5 h-auto"
        >
          <ChevronLeft size={16} />
          <span>Trở lại</span>
        </Button>

        <Button
          variant={activeItem.isSolved ? "default" : "secondary"}
          onClick={handleNext}
          disabled={currentIndex === total - 1}
          className="px-4 py-2.5 h-auto"
        >
          <span>Tiếp theo</span>
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

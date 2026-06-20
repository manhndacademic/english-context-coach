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
import {
  ExercisePractice,
  type ExercisePracticeData,
} from "@/domain/memory/exercise-practice";
import { Button } from "@/components/ui/button";
import { CompletionSummary } from "@/components/completion-summary";
import {
  buildCompletionStats,
  type CompletionStats,
} from "@/components/completion-summary-stats";
import {
  getStepperItemView,
  type StepperItemState,
  type StepperItemActiveState,
} from "@/domain/memory/exercise-view-presenter";

interface StepperIconProps {
  type: "solved" | "retry" | "target";
}

function StepperIcon({ type }: StepperIconProps) {
  if (type === "solved") {
    return <CheckCircle2 size={13} className="shrink-0" />;
  }
  if (type === "retry") {
    return <AlertCircle size={13} className="shrink-0" />;
  }
  return <Target size={13} className="shrink-0 text-muted/60" />;
}

function getStepperItemState(item: {
  isSolved: boolean;
  needsRetry: boolean;
}): StepperItemState {
  if (item.isSolved) return "solved";
  if (item.needsRetry) return "needs-retry";
  return "pending";
}

function getStepperTitle(
  item: { isSolved: boolean; needsRetry: boolean },
  idx: number
): string {
  const status = item.isSolved
    ? "Đã xong"
    : item.needsRetry
      ? "Cần sửa lại"
      : "Chưa làm";
  return `Bài tập ${idx + 1}: ${status}`;
}

export function ExerciseStepper({
  practices,
}: {
  practices: ExercisePracticeData[];
}) {
  const items = useMemo(() => {
    return practices.map((p) => new ExercisePractice(p));
  }, [practices]);

  const [repairIds, setRepairIds] = useState<string[] | null>(null);

  const displayedItems = useMemo(() => {
    if (!repairIds) return items;
    return items.filter((item) => repairIds.includes(item.exercise.id));
  }, [items, repairIds]);

  const initialIndex = useMemo(() => {
    const firstUnsolved = displayedItems.findIndex((item) => !item.isSolved);
    return firstUnsolved === -1 ? 0 : firstUnsolved;
  }, [displayedItems]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [showSummary, setShowSummary] = useState(true);

  const currentIndex =
    activeIndex >= displayedItems.length
      ? Math.max(0, displayedItems.length - 1)
      : activeIndex;

  const activeItem = displayedItems[currentIndex];
  const total = displayedItems.length;
  const solvedCount = displayedItems.filter((item) => item.isSolved).length;

  const allSolved = items.every((item) => item.isSolved);
  const allAttempted = items.every((item) => item.attempts.length > 0);
  const unsolvedCount = items.filter((item) => !item.isSolved).length;
  const needsRepair = unsolvedCount > 0;

  const completionStats = useMemo<CompletionStats>(() => {
    return buildCompletionStats(items);
  }, [items]);

  const handleRetry = useCallback(() => {
    setRepairIds(null);
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

  if (allSolved && showSummary) {
    return (
      <CompletionSummary
        stats={completionStats}
        practices={practices}
        onRetry={handleRetry}
      />
    );
  }

  if (allAttempted && needsRepair && !repairIds) {
    return (
      <div className="border border-border rounded-md p-6 bg-surface grid gap-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="mx-auto bg-warning-light p-3.5 rounded-full text-warning border border-warning/10 w-fit">
          <AlertCircle size={28} />
        </div>
        <div className="grid gap-2">
          <h3 className="text-lg font-bold text-text">
            Sửa lỗi ngay để ghi nhớ sâu!
          </h3>
          <p className="text-sm text-muted max-w-[280px] mx-auto leading-relaxed">
            Bạn có{" "}
            <strong className="text-warning font-extrabold">
              {unsolvedCount}
            </strong>{" "}
            câu trả lời chưa chính xác. Hãy sửa lỗi ngay để ghi nhớ sâu sắc kiến
            thức bài học.
          </p>
        </div>
        <Button
          onClick={() => {
            setRepairIds(
              items
                .filter((item) => !item.isSolved)
                .map((item) => item.exercise.id)
            );
            setActiveIndex(0);
          }}
          className="mt-2 w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 h-auto"
        >
          Bắt đầu sửa lỗi 🚀
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stepper Progress bar */}
      <div className="flex flex-col gap-3 bg-surface-strong p-3.5 px-4 rounded-md border border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text">
            {repairIds ? (
              <span className="inline-flex items-center gap-1.5 text-warning font-bold">
                🛠️ Sửa lỗi: Câu{" "}
                <strong className="font-extrabold">{currentIndex + 1}</strong> /{" "}
                {total}
              </span>
            ) : (
              <>
                Bài tập{" "}
                <strong className="font-bold">{currentIndex + 1}</strong> /{" "}
                {total}
              </>
            )}
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
          {displayedItems.map((item, idx) => {
            const isCurrent = idx === currentIndex;
            const state = getStepperItemState(item);
            const activeState: StepperItemActiveState = isCurrent
              ? "active"
              : "inactive";
            const { className: buttonClassName, iconType: stepperIconType } =
              getStepperItemView(state, activeState);

            return (
              <button
                key={item.exercise.id}
                className={buttonClassName}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Đi tới bài tập ${idx + 1}`}
                title={getStepperTitle(item, idx)}
              >
                <span>Câu {idx + 1}</span>
                <StepperIcon type={stepperIconType} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Active Exercise Card */}
      <div className="animate-in fade-in slide-in-from-bottom-1.5 duration-200">
        <ExerciseCard
          key={activeItem.exercise.id}
          practice={activeItem}
          isCurrent={true}
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

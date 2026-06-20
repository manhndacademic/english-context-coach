"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhrasePracticeCard } from "@/components/phrase-practice-card";
import type { PhrasePracticePlain } from "@/domain/memory/phrase-practice";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PhrasePracticeSession({
  practices,
}: {
  practices: PhrasePracticePlain[];
}) {
  const router = useRouter();
  const [sessionPractices] = useState<PhrasePracticePlain[]>(() => practices);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleComplete = () => {
    if (currentIndex < sessionPractices.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      router.refresh();
      setCurrentIndex(sessionPractices.length);
    }
  };

  if (!sessionPractices.length || currentIndex >= sessionPractices.length) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 sm:p-12 shadow-lg flex flex-col items-center justify-center text-center gap-6 max-w-xl mx-auto w-full transition-all duration-200">
        <div className="bg-success-light text-success p-4 rounded-full border border-success/15 w-16 h-16 flex items-center justify-center animate-pulse shadow-md">
          <CheckCircle2 size={32} />
        </div>
        <div className="grid gap-2">
          <h2 className="text-2xl font-bold font-serif text-text m-0">
            Tuyệt vời!
          </h2>
          <p className="text-muted text-sm max-w-[400px] mx-auto m-0 leading-relaxed">
            Bạn đã hoàn thành tất cả các mục luyện tập cụm từ chủ động hôm nay.
            Hãy tiếp tục duy trì nhé!
          </p>
        </div>
        <Button
          className="h-11 px-6 font-semibold text-sm bg-accent hover:bg-accent-hover text-white transition-all shadow-[0_4px_12px_rgba(5,150,105,0.15)] hover:-translate-y-px rounded-lg flex items-center gap-2 cursor-pointer"
          onClick={() => router.push("/dashboard")}
        >
          Quay lại bảng điều khiển <ArrowRight size={14} />
        </Button>
      </div>
    );
  }

  const currentPractice = sessionPractices[currentIndex];

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5 mb-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
          <span>Tiến độ luyện tập</span>
          <span>
            {currentIndex + 1} / {sessionPractices.length} cụm từ
          </span>
        </div>
        <div className="h-2 bg-surface-strong border border-border rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-accent transition-all duration-300 rounded-full"
            style={{
              width: `${(currentIndex / sessionPractices.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <PhrasePracticeCard
        key={currentPractice.id}
        practice={currentPractice}
        onComplete={handleComplete}
      />
    </div>
  );
}

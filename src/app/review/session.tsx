"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewCard } from "@/components/review-card";
import type { MistakePattern } from "@/db/schema";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewSession({
  patterns,
}: {
  patterns: MistakePattern[];
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleComplete = () => {
    if (currentIndex < patterns.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Refresh the page to load fresh due patterns
      router.refresh();
      setCurrentIndex(0);
    }
  };

  if (!patterns.length || currentIndex >= patterns.length) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-9 border border-dashed border-border rounded-md bg-surface gap-5">
        <CheckCircle2 className="text-success" size={48} aria-hidden="true" />
        <h2 className="text-xl font-bold font-serif text-text m-0">Tuyệt vời!</h2>
        <p className="text-muted text-sm max-w-[400px] m-0">Bạn đã hoàn thành tất cả các mục ôn tập cần thiết hôm nay.</p>
        <Button className="h-11" onClick={() => router.push("/dashboard")}>
          Quay lại bảng điều khiển
        </Button>
      </div>
    );
  }

  const currentPattern = patterns[currentIndex];

  return (
    <div className="grid gap-5">
      <div className="grid gap-2 mb-4 text-xs sm:text-sm font-bold text-muted">
        <span>Đang ôn tập: {currentIndex + 1} / {patterns.length} cụm từ</span>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${((currentIndex) / patterns.length) * 100}%` }}
          />
        </div>
      </div>
      
      <ReviewCard
        key={currentPattern.id}
        pattern={currentPattern}
        onComplete={handleComplete}
      />
    </div>
  );
}

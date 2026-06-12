"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewCard } from "@/components/review-card";
import type { MistakePattern } from "@/db/schema";
import { CheckCircle2 } from "lucide-react";

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
      <div className="empty-state stack">
        <CheckCircle2 className="status-succeeded" size={48} aria-hidden="true" />
        <h2>Tuyệt vời!</h2>
        <p className="muted">Bạn đã hoàn thành tất cả các mục ôn tập cần thiết hôm nay.</p>
        <button className="primary-button" onClick={() => router.push("/dashboard")}>
          Quay lại bảng điều khiển
        </button>
      </div>
    );
  }

  const currentPattern = patterns[currentIndex];

  return (
    <div className="stack">
      <div className="review-progress-bar">
        <span>Đang ôn tập: {currentIndex + 1} / {patterns.length} cụm từ</span>
        <div className="progress-track">
          <div
            className="progress-fill"
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

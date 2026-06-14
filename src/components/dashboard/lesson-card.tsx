import React from "react";
import Link from "next/link";
import {
  Clock,
  BrainCircuit,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileCode2,
  Mail,
  BookOpen,
  Code,
  FileText,
} from "lucide-react";

interface LessonCardProps {
  lesson: {
    id: string;
    title: string | null;
    textType: string | null;
    detectedLevel: string | null;
    version: number;
    analysisStatus: string;
    exerciseStatus: string;
  };
}

const translateStatus = (status: string) => {
  switch (status) {
    case "pending":
      return {
        label: "Đang chờ",
        icon: <Clock size={12} />,
        className: "status-pending",
      };
    case "running":
      return {
        label: "Đang phân tích",
        icon: <BrainCircuit size={12} className="animate-spin" />,
        className: "status-running",
      };
    case "succeeded":
      return {
        label: "Sẵn sàng",
        icon: <CheckCircle size={12} />,
        className: "status-succeeded",
      };
    case "failed":
      return {
        label: "Lỗi phân tích",
        icon: <XCircle size={12} />,
        className: "status-failed",
      };
    default:
      return { label: status, icon: null, className: "" };
  }
};

const getDocIcon = (type: string | null) => {
  switch (type) {
    case "work_message":
      return <MessageSquare size={16} className="text-muted" />;
    case "technical_doc":
      return <FileCode2 size={16} className="text-muted" />;
    case "email":
      return <Mail size={16} className="text-muted" />;
    case "academic":
      return <BookOpen size={16} className="text-muted" />;
    case "code":
      return <Code size={16} className="text-muted" />;
    default:
      return <FileText size={16} className="text-muted" />;
  }
};

export function LessonCard({ lesson }: LessonCardProps) {
  const analysis = translateStatus(lesson.analysisStatus);
  const exercise = translateStatus(lesson.exerciseStatus);

  return (
    <Link
      className="flex flex-col min-[600px]:flex-row items-stretch min-[600px]:items-center justify-between gap-3 min-[600px]:gap-4 p-4 border border-border rounded-md bg-surface text-text no-underline transition-all duration-150 hover:-translate-y-px hover:border-accent hover:shadow-sm"
      href={`/lessons/${lesson.id}`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="bg-surface-strong p-2.5 rounded-md flex items-center justify-center shrink-0">
          {getDocIcon(lesson.textType)}
        </div>
        <div className="min-w-0 grid gap-1">
          <strong className="text-base font-bold text-text truncate block">
            {lesson.title || "Bài học không tên"}
          </strong>
          <span className="text-muted text-xs leading-none truncate block">
            Thể loại: {lesson.textType?.replaceAll("_", " ") ?? "general"} ·
            Trình độ: {lesson.detectedLevel ?? "Đang xác định"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-start min-[600px]:justify-end gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border leading-none ${analysis.className}`}
        >
          {analysis.icon}
          <span>Phân tích: {analysis.label}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border leading-none ${exercise.className}`}
        >
          {exercise.icon}
          <span>Bài tập: {exercise.label}</span>
        </span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold border border-border bg-surface-strong text-muted leading-none">
          Bản {lesson.version}
        </span>
      </div>
    </Link>
  );
}

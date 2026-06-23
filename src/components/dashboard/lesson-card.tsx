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
  Ticket,
  ClipboardList,
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
    case "idle":
      return {
        label: "Chưa tạo",
        icon: <Clock size={12} className="text-muted" />,
        className: "border-border bg-surface-strong text-muted",
      };
    case "pending":
      return {
        label: "Đang chờ",
        icon: <Clock size={12} className="text-warning-strong/80" />,
        className: "border-warning/30 bg-warning-light text-warning-strong",
      };
    case "running":
      return {
        label: "Đang phân tích",
        icon: <BrainCircuit size={12} className="animate-spin text-info" />,
        className: "border-info/30 bg-info-light text-info-strong",
      };
    case "succeeded":
      return {
        label: "Sẵn sàng",
        icon: <CheckCircle size={12} className="text-success" />,
        className: "border-success/30 bg-success-light text-success-strong",
      };
    case "failed":
      return {
        label: "Lỗi phân tích",
        icon: <XCircle size={12} className="text-danger" />,
        className: "border-danger/30 bg-danger-light text-danger-strong",
      };
    default:
      return {
        label: status,
        icon: null,
        className: "border-border bg-surface-strong text-muted",
      };
  }
};

const getDocIcon = (type: string | null) => {
  switch (type) {
    case "work_message":
    case "chat_message":
      return <MessageSquare size={16} className="text-muted" />;
    case "technical_doc":
      return <FileCode2 size={16} className="text-muted" />;
    case "email":
      return <Mail size={16} className="text-muted" />;
    case "academic":
      return <BookOpen size={16} className="text-muted" />;
    case "code":
    case "code_review":
      return <Code size={16} className="text-muted" />;
    case "ticket":
      return <Ticket size={16} className="text-muted" />;
    case "meeting_notes":
      return <ClipboardList size={16} className="text-muted" />;
    default:
      return <FileText size={16} className="text-muted" />;
  }
};

export function LessonCard({ lesson }: LessonCardProps) {
  const analysis = translateStatus(lesson.analysisStatus);
  const exercise = translateStatus(lesson.exerciseStatus);

  return (
    <Link
      className="hover-lift flex flex-col gap-4.5 p-5 border border-border rounded-md bg-surface text-text no-underline"
      href={`/lessons/${lesson.id}`}
    >
      <div className="flex items-start gap-4 min-w-0">
        <div className="bg-surface-strong p-2.5 rounded-md flex items-center justify-center shrink-0 mt-0.5">
          {getDocIcon(lesson.textType)}
        </div>
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <strong
            className="text-base md:text-lg font-bold text-text line-clamp-2 block leading-snug"
            title={lesson.title || "Bài học không tên"}
          >
            {lesson.title || "Bài học không tên"}
          </strong>
          <span className="text-muted text-xs leading-none">
            Thể loại: {lesson.textType?.replaceAll("_", " ") ?? "general"} ·
            Trình độ: {lesson.detectedLevel ?? "Đang xác định"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3.5 border-t border-border/50">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border leading-none ${analysis.className}`}
        >
          {analysis.icon}
          <span>Phân tích: {analysis.label}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border leading-none ${exercise.className}`}
        >
          {exercise.icon}
          <span>Bài tập: {exercise.label}</span>
        </span>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-border bg-surface-strong text-muted leading-none">
          Bản {lesson.version}
        </span>
      </div>
    </Link>
  );
}

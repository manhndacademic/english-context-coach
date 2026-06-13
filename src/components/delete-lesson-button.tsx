"use client";

import { useState, useTransition } from "react";
import { deleteSourceTextAction } from "@/app/actions/source-texts";
import { ConfirmDialog } from "@/components/ui/dialog";

interface DeleteLessonButtonProps {
  sourceTextId: string;
}

export function DeleteLessonButton({ sourceTextId }: DeleteLessonButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("sourceTextId", sourceTextId);
      await deleteSourceTextAction(formData);
    });
  };

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-4 font-semibold text-sm transition-all shadow-sm bg-danger text-white hover:opacity-90 hover:-translate-y-px h-[38px] cursor-pointer"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Xoá nguồn
      </button>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleConfirm}
        isPending={isPending}
        title="Xoá nguồn bài học"
        description="Bạn có chắc chắn muốn xoá bài học này không? Mọi lịch sử làm bài và lỗi liên quan sẽ bị xoá vĩnh viễn và không thể hoàn tác."
        confirmText="Xoá vĩnh viễn"
        variant="danger"
      />
    </>
  );
}

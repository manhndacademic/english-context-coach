"use client";

import { deleteSourceTextAction } from "@/app/actions/source-texts";

interface DeleteLessonButtonProps {
  sourceTextId: string;
}

export function DeleteLessonButton({ sourceTextId }: DeleteLessonButtonProps) {
  return (
    <form
      action={deleteSourceTextAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Bạn có chắc chắn muốn xoá bài học này không? Mọi lịch sử làm bài và lỗi liên quan sẽ bị xoá vĩnh viễn và không thể hoàn tác."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input name="sourceTextId" type="hidden" value={sourceTextId} />
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-4 font-semibold text-sm transition-all shadow-sm bg-danger text-white hover:opacity-90 hover:-translate-y-px h-[38px] cursor-pointer"
        type="submit"
      >
        Xoá nguồn
      </button>
    </form>
  );
}

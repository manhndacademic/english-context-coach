"use client";

import { deleteSystemApiKeyAction } from "@/app/actions/admin-keys";
import { Trash2 } from "lucide-react";

interface DeleteKeyButtonProps {
  keyId: string;
  keyName: string;
}

export function DeleteKeyButton({ keyId, keyName }: DeleteKeyButtonProps) {
  return (
    <form action={deleteSystemApiKeyAction}>
      <input type="hidden" name="keyId" value={keyId} />
      <button
        type="submit"
        title="Xóa key"
        className="p-1.5 rounded-md border border-border bg-surface text-danger hover:bg-danger-light transition-all cursor-pointer"
        onClick={(e) => {
          if (!confirm(`Bạn có chắc chắn muốn xóa key "${keyName}" không?`)) {
            e.preventDefault();
          }
        }}
      >
        <Trash2 size={14} />
      </button>
    </form>
  );
}

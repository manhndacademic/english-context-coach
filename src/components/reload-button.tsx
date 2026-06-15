"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ReloadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleReload = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Button
      className="w-full h-11 font-semibold flex items-center justify-center gap-2"
      onClick={handleReload}
      disabled={isPending}
    >
      <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
      {isPending ? "Đang tải lại..." : "Tải lại trang"}
    </Button>
  );
}

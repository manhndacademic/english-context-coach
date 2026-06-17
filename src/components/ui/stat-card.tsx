import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  valueVariant?: "default" | "accent" | "success" | "warning" | "danger";
}

function StatCard({
  className,
  label,
  value,
  valueVariant = "default",
  ...props
}: StatCardProps) {
  const valueColorMap = {
    default: "text-text",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };

  return (
    <div
      className={cn(
        "hover-lift bg-surface border border-border rounded-lg p-4 shadow-sm grid gap-1",
        className
      )}
      {...props}
    >
      <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
        {label}
      </span>
      <strong
        className={cn(
          "text-2xl font-bold leading-tight",
          valueColorMap[valueVariant]
        )}
      >
        {value}
      </strong>
    </div>
  );
}

export { StatCard };

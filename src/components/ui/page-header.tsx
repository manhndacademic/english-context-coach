import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

function PageHeader({
  className,
  title,
  description,
  icon,
  backHref,
  backLabel = "Quay về",
  actions,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-5 mb-2",
        className
      )}
      {...props}
    >
      {backHref && (
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-bold text-accent no-underline hover:underline mb-1"
          >
            <ArrowLeft size={12} /> {backLabel}
          </Link>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-1 text-text m-0 flex items-center gap-2">
            {icon && <span className="text-accent shrink-0">{icon}</span>}
            {title}
          </h1>
          {description && (
            <p className="text-muted text-sm leading-relaxed m-0 mt-1">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}

export { PageHeader };

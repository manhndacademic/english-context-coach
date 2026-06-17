import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function SectionCard({ className, children, ...props }: SectionCardProps) {
  return (
    <section
      className={cn(
        "bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

interface SectionCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

function SectionCardHeader({
  className,
  title,
  description,
  icon,
  actions,
  ...props
}: SectionCardHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 mb-1",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="text-muted shrink-0">{icon}</div>}
        <div>
          <h2 className="text-xl font-bold font-serif text-text m-0 leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-muted text-sm m-0 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

interface SectionCardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function SectionCardBody({
  className,
  children,
  ...props
}: SectionCardBodyProps) {
  return (
    <div className={cn("grid gap-4", className)} {...props}>
      {children}
    </div>
  );
}

interface SectionCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function SectionCardFooter({
  className,
  children,
  ...props
}: SectionCardFooterProps) {
  return (
    <div
      className={cn(
        "border-t border-border pt-4 mt-2 flex items-center justify-between gap-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

SectionCard.Header = SectionCardHeader;
SectionCard.Body = SectionCardBody;
SectionCard.Footer = SectionCardFooter;

export { SectionCard };

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

function PageContainer({ className, children, ...props }: PageContainerProps) {
  return (
    <main
      className={cn(
        "max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6",
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}

interface PageLayoutProps {
  user: {
    email?: string | null;
    role?: string;
    image?: string | null;
  };
  children: React.ReactNode;
  containerClassName?: string;
}

function PageLayout({ user, children, containerClassName }: PageLayoutProps) {
  const isAdmin = user.role === "admin";
  return (
    <>
      <AppHeader email={user.email} isAdmin={isAdmin} image={user.image} />
      <PageContainer className={containerClassName}>{children}</PageContainer>
    </>
  );
}

export { PageLayout, PageContainer };

import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ practiceId?: string }>;
}

export default async function PhrasePracticePage({ searchParams }: PageProps) {
  const { practiceId } = await searchParams;
  if (practiceId) {
    redirect(`/review?patternId=${practiceId}`);
  } else {
    redirect("/review");
  }
}

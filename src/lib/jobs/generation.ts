import { getLessonRepository } from "@/domain/lesson";

export async function deleteSourceTextWithPrivacy(input: {
  userId: string;
  sourceTextId: string;
}) {
  const repo = getLessonRepository();
  await repo.deleteSourceText(input.userId, input.sourceTextId);
}

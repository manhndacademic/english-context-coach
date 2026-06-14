import { getSourceTextRepository } from "@/domain/lesson";

export async function deleteSourceTextWithPrivacy(input: {
  userId: string;
  sourceTextId: string;
}) {
  const repo = getSourceTextRepository();
  await repo.deleteSourceText(input.userId, input.sourceTextId);
}

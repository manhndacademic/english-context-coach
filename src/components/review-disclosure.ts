export function getReviewDisclosureState(hasSubmitted: boolean) {
  return {
    showPreAnswerPrompt: !hasSubmitted,
    showCorrectMeaning: hasSubmitted,
    showOldMistakeContext: hasSubmitted,
  };
}

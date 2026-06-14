import { PROMPT_VERSIONS } from "@/domain/constants";

export { analysisPrompt, analysisJsonShape } from "./analysis-prompt";
export { exercisesPrompt, exercisesJsonShape } from "./exercise-prompt";
export { gradingPrompt, gradingJsonShape } from "./grading-prompt";
export {
  reviewPromptGenerationPrompt,
  reviewPromptJsonShape,
} from "./review-prompt";
export { repairPrompt, repairJsonShapes } from "./repair-prompt";

export const promptVersions = PROMPT_VERSIONS;

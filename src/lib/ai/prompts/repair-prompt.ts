import { analysisJsonShape } from "./analysis-prompt";
import { exercisesJsonShape } from "./exercise-prompt";
import { gradingJsonShape } from "./grading-prompt";

export const repairJsonShapes = {
  analysis: analysisJsonShape,
  exercises: exercisesJsonShape,
  grading: gradingJsonShape,
} as const;

export function repairPrompt(rawJson: string, schemaName: string) {
  const expectedShape =
    repairJsonShapes[schemaName as keyof typeof repairJsonShapes];
  return [
    `Repair this ${schemaName} response into valid strict JSON only.`,
    "The top-level JSON value must be an object, not an array.",
    expectedShape
      ? `Expected JSON shape:\n${JSON.stringify(expectedShape)}`
      : undefined,
    "Keep the same meaning. Do not add markdown.",
    rawJson,
  ]
    .filter(Boolean)
    .join("\n\n");
}

import type { Prompt } from "./prompt";

export interface GenerateJsonOptions<T> {
  userId?: string;
  lessonId?: string;
  prompt: Prompt<T>;
  onThought?: (text: string) => Promise<void>;
}

export type GenerateJsonFn = <T>(options: GenerateJsonOptions<T>) => Promise<T>;

export interface LlmProvider {
  generateJson: GenerateJsonFn;
}

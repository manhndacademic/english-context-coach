import { z } from "zod";
import type { AiPurpose, AiModelKind } from "@/domain/types";

export interface Prompt<T> {
  purpose: AiPurpose;
  promptVersion: string;
  schemaVersion: string;
  schema: z.ZodType<T>;
  modelKind: AiModelKind;
  render(): string;
  expectedShape?: Record<string, any>;
}

import { type DbClient } from "@/db";
import type { RecordRequestOptions } from "../../domain/types";

export type RecordRequestFn = (
  options: RecordRequestOptions,
  dbClient?: DbClient
) => Promise<void>;

export interface AiRequestRecorder {
  recordRequest: RecordRequestFn;
}

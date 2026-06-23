import { getLogger } from "@/lib/logger";

const log = getLogger("d.l.engine.LessonGenerationEngine");

export function isTransientGenerationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    (error instanceof Error && error.name === "AbortError") ||
    message.includes("AbortError") ||
    message.includes("The operation was aborted") ||
    message.includes("ECONNRESET") ||
    message.includes("socket connection was closed") ||
    message.includes('"code":429') ||
    message.includes("Too Many Requests") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes('"code":503') ||
    message.includes("UNAVAILABLE") ||
    message.includes("high demand")
  );
}

export function logSpringStyle(
  level: "INFO" | "WARN" | "ERROR",
  workerId: string,
  message: string
): void {
  if (level === "ERROR") {
    log.error(message, undefined, workerId);
  } else if (level === "WARN") {
    log.warn(message, workerId);
  } else {
    log.info(message, workerId);
  }
}

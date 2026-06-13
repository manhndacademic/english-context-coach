/**
 * Spring-style Logger for English Context Coach.
 * Format: YYYY-MM-DD HH:mm:ss.SSS  LEVEL PID --- [  ThreadName] LoggerName : Message
 */

const useColors = 
  typeof process !== "undefined" &&
  process.stdout?.isTTY &&
  !process.env.NO_COLOR &&
  process.env.NODE_ENV !== "production";

// ANSI escape codes
const COLORS = {
  RESET: "\x1b[0m",
  DIM: "\x1b[2m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  RED: "\x1b[31m",
  CYAN: "\x1b[36m",
  MAGENTA: "\x1b[35m",
};

export type LogLevel = "INFO" | "WARN" | "ERROR";

export class Logger {
  private loggerName: string;
  private defaultThread: string;

  constructor(loggerName: string, defaultThread: string = "main") {
    this.loggerName = loggerName;
    this.defaultThread = defaultThread;
  }

  private formatTimestamp(): string {
    const now = new Date();
    // Format: YYYY-MM-DD HH:mm:ss.SSS
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    
    const ts = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
    return useColors ? `${COLORS.DIM}${ts}${COLORS.RESET}` : ts;
  }

  private formatLevel(level: LogLevel): string {
    let coloredLevel = level.padEnd(5);
    if (useColors) {
      if (level === "INFO") coloredLevel = `${COLORS.GREEN}${coloredLevel}${COLORS.RESET}`;
      else if (level === "WARN") coloredLevel = `${COLORS.YELLOW}${coloredLevel}${COLORS.RESET}`;
      else if (level === "ERROR") coloredLevel = `${COLORS.RED}${coloredLevel}${COLORS.RESET}`;
    }
    return coloredLevel;
  }

  private formatThread(thread?: string): string {
    const name = (thread || this.defaultThread).slice(0, 15);
    const padded = name.padStart(15);
    return useColors ? `${COLORS.MAGENTA}${padded}${COLORS.RESET}` : padded;
  }

  private formatLoggerName(): string {
    const padded = this.loggerName.padEnd(40);
    return useColors ? `${COLORS.CYAN}${padded}${COLORS.RESET}` : padded;
  }

  info(message: string, thread?: string) {
    const ts = this.formatTimestamp();
    const levelStr = this.formatLevel("INFO");
    const pid = process.pid.toString().padStart(5);
    const th = this.formatThread(thread);
    const name = this.formatLoggerName();
    console.info(`${ts}  ${levelStr} ${pid} --- [${th}] ${name} : ${message}`);
  }

  warn(message: string, thread?: string) {
    const ts = this.formatTimestamp();
    const levelStr = this.formatLevel("WARN");
    const pid = process.pid.toString().padStart(5);
    const th = this.formatThread(thread);
    const name = this.formatLoggerName();
    console.warn(`${ts}  ${levelStr} ${pid} --- [${th}] ${name} : ${message}`);
  }

  error(message: string, error?: unknown, thread?: string) {
    const ts = this.formatTimestamp();
    const levelStr = this.formatLevel("ERROR");
    const pid = process.pid.toString().padStart(5);
    const th = this.formatThread(thread);
    const name = this.formatLoggerName();
    
    let errorSuffix = "";
    if (error !== undefined) {
      if (error instanceof Error) {
        errorSuffix = `\n${error.stack || error.message}`;
      } else {
        errorSuffix = `\n${String(error)}`;
      }
    }

    console.error(`${ts}  ${levelStr} ${pid} --- [${th}] ${name} : ${message}${errorSuffix}`);
  }
}

export function getLogger(loggerName: string, defaultThread?: string): Logger {
  return new Logger(loggerName, defaultThread);
}

export function parseDbDate(dateVal: unknown): Date | null {
  if (!dateVal) return null;
  const d = new Date(dateVal as any);
  if (isNaN(d.getTime())) return null;

  return new Date(Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  ));
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLogger } from "./logger";

describe("Logger Level Filtering", () => {
  let debugSpy: any;
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it("should not log debug or trace messages when LOG_LEVEL is INFO", () => {
    process.env.LOG_LEVEL = "INFO";
    const logger = getLogger("test-logger");

    logger.trace("trace message");
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("should log debug but not trace when LOG_LEVEL is DEBUG", () => {
    process.env.LOG_LEVEL = "DEBUG";
    const logger = getLogger("test-logger");

    logger.trace("trace message");
    logger.debug("debug message");
    logger.info("info message");

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0][0]).toContain("DEBUG");
    expect(debugSpy.mock.calls[0][0]).toContain("debug message");
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("should log trace messages when LOG_LEVEL is TRACE", () => {
    process.env.LOG_LEVEL = "TRACE";
    const logger = getLogger("test-logger");

    logger.trace("trace message");
    logger.debug("debug message");

    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(debugSpy.mock.calls[0][0]).toContain("TRACE");
    expect(debugSpy.mock.calls[0][0]).toContain("trace message");
    expect(debugSpy.mock.calls[1][0]).toContain("DEBUG");
    expect(debugSpy.mock.calls[1][0]).toContain("debug message");
  });

  it("should respect case insensitivity of LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "warn";
    const logger = getLogger("test-logger");

    logger.info("info message");
    logger.warn("warn message");

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});

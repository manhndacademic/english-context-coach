import { describe, expect, it, vi, beforeEach } from "vitest";
import { getUserUsageStats } from "./getUserUsageStats";

function makeSchemaProxy(): any {
  const cache = new Map<string | symbol, any>();
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (!cache.has(prop)) {
        cache.set(prop, new Proxy({}, handler));
      }
      return cache.get(prop);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/db", () => ({
  db: {},
  schema: makeSchemaProxy(),
  sql: (strings: TemplateStringsArray) => strings.join(""),
}));

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("usage-repository/getUserUsageStats", () => {
  let mockDbClient: any;

  beforeEach(() => {
    mockDbClient = {
      select: vi.fn(),
    };
  });

  it("fetches, aggregates, formats and returns usage statistics successfully", async () => {
    const mockSummary = [
      {
        totalRequests: 5,
        succeededRequests: 4,
        totalInputTokens: 500,
        totalOutputTokens: 1000,
        avgLatencyMs: 2500,
      },
    ];
    const mockDaily = [
      {
        dateStr: new Date().toISOString().split("T")[0],
        requests: 5,
        inputTokens: 500,
        outputTokens: 1000,
      },
    ];
    const mockRecent = [
      {
        id: "req-1",
        purpose: "grading",
        model: "gemini-1.5-flash",
        status: "succeeded",
        latencyMs: 2000,
        errorMessage: null,
        createdAt: new Date(),
      },
    ];
    const mockKeyCounts = [{ active: 1, invalid: 0, rateLimited: 0, total: 1 }];

    // mockDbClient.select resolves 4 promises in Promise.all
    mockDbClient.select
      .mockReturnValueOnce(mockChain(mockSummary))
      .mockReturnValueOnce(mockChain(mockDaily))
      .mockReturnValueOnce(mockChain(mockRecent))
      .mockReturnValueOnce(mockChain(mockKeyCounts));

    const stats = await getUserUsageStats("user-1", "7days", mockDbClient);

    expect(stats.summary.totalRequests).toBe(5);
    expect(stats.summary.successRate).toBe(80);
    expect(stats.summary.totalTokens).toBe(1500);
    expect(stats.summary.inputTokens).toBe(500);
    expect(stats.summary.outputTokens).toBe(1000);
    expect(stats.summary.avgLatencySec).toBe(2.5);
    expect(stats.summary.personalKeys.total).toBe(1);
    expect(stats.recent).toHaveLength(1);
    expect(stats.daily).toHaveLength(7); // 7days timeframe returns 7 items
  });
});

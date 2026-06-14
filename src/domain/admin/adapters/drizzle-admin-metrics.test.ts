import { describe, expect, it, vi, beforeEach } from "vitest";
import { DrizzleAdminMetricsRepository } from "./drizzle-admin-metrics";

function makeSchemaProxy(): any {
  const handler: ProxyHandler<object> = {
    get(_target, _prop) {
      return new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/db", () => ({
  db: {},
  schema: makeSchemaProxy(),
}));

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    set: () => chain,
    values: () => chain,
    returning: () => chain,
    groupBy: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("DrizzleAdminMetricsRepository", () => {
  let repository: DrizzleAdminMetricsRepository;
  let mockDbClient: any;

  beforeEach(() => {
    mockDbClient = {
      select: vi.fn(),
    };
    repository = new DrizzleAdminMetricsRepository(mockDbClient);
  });

  it("getOverallAiStats - returns parsed results", async () => {
    const mockRow = {
      totalCount: 10,
      successCount: 8,
      totalInputTokens: 1000,
      totalOutputTokens: 2000,
      totalCostMicros: 300,
      avgLatency: 500,
    };
    mockDbClient.select.mockReturnValueOnce(mockChain([mockRow]));

    const result = await repository.getOverallAiStats();
    expect(result).toEqual(mockRow);
  });

  it("getDailyAiMetrics - returns daily metrics array", async () => {
    const mockRows = [
      { date: "2026-06-14", requests: 5, cost: 150, tokens: 1500 },
    ];
    mockDbClient.select.mockReturnValueOnce(mockChain(mockRows));

    const result = await repository.getDailyAiMetrics(30);
    expect(result).toEqual(mockRows);
  });

  it("getAiStatsByModel - returns model stats array", async () => {
    const mockRows = [
      {
        model: "gemini-3.5-flash",
        requests: 10,
        tokens: 3000,
        costMicros: 450,
      },
    ];
    mockDbClient.select.mockReturnValueOnce(mockChain(mockRows));

    const result = await repository.getAiStatsByModel();
    expect(result).toEqual(mockRows);
  });

  it("getAiStatsByPurpose - returns purpose stats array", async () => {
    const mockRows = [{ purpose: "grading", requests: 8, tokens: 2000 }];
    mockDbClient.select.mockReturnValueOnce(mockChain(mockRows));

    const result = await repository.getAiStatsByPurpose();
    expect(result).toEqual(mockRows);
  });

  it("getApiKeysStatusCounts - returns keys count object", async () => {
    const mockRow = {
      active: 3,
      rateLimited: 1,
      invalid: 0,
      total: 4,
    };
    mockDbClient.select.mockReturnValueOnce(mockChain([mockRow]));

    const result = await repository.getApiKeysStatusCounts();
    expect(result).toEqual(mockRow);
  });

  it("getActiveUserCount - queries all tables and returns distinct user count", async () => {
    const since = new Date();
    // mock three sequential select chain returns
    mockDbClient.select
      .mockReturnValueOnce(
        mockChain([{ userId: "user-1" }, { userId: "user-2" }])
      )
      .mockReturnValueOnce(
        mockChain([{ userId: "user-2" }, { userId: "user-3" }])
      )
      .mockReturnValueOnce(mockChain([{ userId: "user-4" }]));

    const result = await repository.getActiveUserCount(since);
    expect(result).toBe(4); // user-1, user-2, user-3, user-4
  });

  it("getAiErrorStats24h - returns total and failed counts", async () => {
    const since = new Date();
    const mockRow = { total: 20, failed: 2 };
    mockDbClient.select.mockReturnValueOnce(mockChain([mockRow]));

    const result = await repository.getAiErrorStats24h(since);
    expect(result).toEqual(mockRow);
  });

  it("getTopUsersByResourceUsage - returns top users list", async () => {
    const mockRows = [
      {
        userId: "user-1",
        email: "user1@example.com",
        customKeyConfigured: false,
        totalRequests: 15,
        totalTokens: 5000,
        totalCostUsd: 0.05,
      },
    ];
    mockDbClient.select.mockReturnValueOnce(mockChain(mockRows));

    const result = await repository.getTopUsersByResourceUsage(10);
    expect(result).toEqual(mockRows);
  });

  it("getJobStatusBreakdown - returns job status rows", async () => {
    const mockRows = [{ status: "succeeded", count: 12 }];
    mockDbClient.select.mockReturnValueOnce(mockChain(mockRows));

    const result = await repository.getJobStatusBreakdown();
    expect(result).toEqual(mockRows);
  });

  it("getActiveAndFailedJobs - returns active & failed jobs", async () => {
    const mockRows = [
      {
        id: "job-1",
        userId: "user-1",
        email: "user1@example.com",
        status: "failed",
        stage: "analysis",
        attempts: 3,
        errorMessage: "Timeout error",
        createdAt: new Date(),
      },
    ];
    mockDbClient.select.mockReturnValueOnce(mockChain(mockRows));

    const result = await repository.getActiveAndFailedJobs(10);
    expect(result).toEqual(mockRows);
  });
});

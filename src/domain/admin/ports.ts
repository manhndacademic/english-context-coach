export interface AdminMetricsRepository {
  getOverallAiStats(): Promise<{
    totalCount: number;
    successCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostMicros: number;
    avgLatency: number;
  }>;

  getDailyAiMetrics(limit: number): Promise<
    Array<{
      date: string;
      requests: number;
      cost: number;
      tokens: number;
    }>
  >;

  getAiStatsByModel(): Promise<
    Array<{
      model: string;
      requests: number;
      tokens: number;
      costMicros: number;
    }>
  >;

  getAiStatsByPurpose(): Promise<
    Array<{
      purpose: string;
      requests: number;
      tokens: number;
    }>
  >;

  getApiKeysStatusCounts(): Promise<{
    active: number;
    rateLimited: number;
    invalid: number;
    total: number;
  }>;

  getActiveUserCount(since: Date): Promise<number>;

  getAiErrorStats24h(since: Date): Promise<{
    total: number;
    failed: number;
  }>;

  getDigestStatsByDate(digestDate: string): Promise<{
    sent: number;
    skipped: number;
    failed: number;
    enabledUsers: number;
  }>;

  getTopUsersByResourceUsage(limit: number): Promise<
    Array<{
      userId: string | null;
      email: string | null;
      customKeyConfigured: boolean;
      totalRequests: number;
      totalTokens: number;
      totalCostUsd: number;
    }>
  >;

  getJobStatusBreakdown(): Promise<
    Array<{
      status: string;
      count: number;
    }>
  >;

  getActiveAndFailedJobs(limit: number): Promise<
    Array<{
      id: string;
      userId: string | null;
      email: string | null;
      status: string;
      stage: string;
      attempts: number;
      errorMessage: string | null;
      createdAt: Date;
    }>
  >;
}

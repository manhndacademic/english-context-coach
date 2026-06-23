import { describe, expect, it, vi, beforeEach } from "vitest";
import { GetUserUsageStatsService } from "./get-user-usage-stats";
import type { UsageRepository } from "../ports/usage-repository";

describe("getUserUsageStats Use Case", () => {
  let mockUsageRepo: UsageRepository;

  beforeEach(() => {
    mockUsageRepo = {
      getUserUsageStats: vi.fn(),
    };
  });

  it("delegates fetching usage statistics to the repository port", async () => {
    const mockStats: any = { summary: {}, daily: [], recent: [] };
    vi.mocked(mockUsageRepo.getUserUsageStats).mockResolvedValue(mockStats);

    const useCase = new GetUserUsageStatsService(mockUsageRepo);
    const result = await useCase.execute("user-1", "7days");
    expect(result).toBe(mockStats);
    expect(mockUsageRepo.getUserUsageStats).toHaveBeenCalledWith(
      "user-1",
      "7days"
    );
  });
});

import { describe, expect, it, beforeEach, vi } from "vitest";
import { z } from "zod";
import type { ApiKeyRepository, AiRequestRecorder, Prompt } from "../ports";
import { GeminiLLMProvider } from "./gemini-provider";

vi.mock("@/lib/crypto", () => ({
  decryptApiKey: (key: string) => key,
  encryptApiKey: (key: string) => key,
  sha256: (text: string) => text,
  hashCanonicalPayload: (payload: any) => JSON.stringify(payload),
}));

class MockApiKeyRepository implements ApiKeyRepository {
  systemKeys: Array<{
    id: string;
    name: string;
    encryptedKey: string;
    status: string;
    rateLimitedAt: Date | null;
  }> = [];

  userKeys = new Map<
    string,
    Array<{
      id: string;
      encryptedKey: string;
      status: string;
      rateLimitedAt: Date | null;
    }>
  >();

  legacyUserKeys = new Map<string, string>();

  updatedKeys: Array<{
    keyId: string;
    status: "active" | "rate_limited" | "invalid";
    errorMessage: string | null;
  }> = [];

  async getSystemKeys() {
    return this.systemKeys;
  }

  async getUserKeys(userId: string) {
    return this.userKeys.get(userId) ?? [];
  }

  async getLegacyUserKey(userId: string) {
    return this.legacyUserKeys.get(userId) ?? null;
  }

  async updateKeyStatus(
    keyId: string,
    status: "active" | "rate_limited" | "invalid",
    errorMessage: string | null
  ) {
    this.updatedKeys.push({ keyId, status, errorMessage });

    const sysKey = this.systemKeys.find((k) => k.id === keyId);
    if (sysKey) {
      sysKey.status = status;
      sysKey.rateLimitedAt = status === "rate_limited" ? new Date() : null;
    }

    for (const [_, ukeys] of this.userKeys.entries()) {
      const ukey = ukeys.find((k) => k.id === keyId);
      if (ukey) {
        ukey.status = status;
        ukey.rateLimitedAt = status === "rate_limited" ? new Date() : null;
      }
    }
  }

  async restoreKeyToActive(keyId: string) {
    await this.updateKeyStatus(keyId, "active", null);
  }

  async saveUserApiKey(userId: string, encryptedApiKey: string | null) {
    if (encryptedApiKey) {
      this.legacyUserKeys.set(userId, encryptedApiKey);
    } else {
      this.legacyUserKeys.delete(userId);
    }
  }

  addKey(options: {
    key: string;
    id: string;
    isUserKey: boolean;
    userId?: string;
  }) {
    if (options.isUserKey) {
      const userId = options.userId || "u-1";
      const list = this.userKeys.get(userId) ?? [];
      list.push({
        id: options.id,
        encryptedKey: options.key,
        status: "active",
        rateLimitedAt: null,
      });
      this.userKeys.set(userId, list);
    } else {
      this.systemKeys.push({
        id: options.id,
        name: `Key ${options.id}`,
        encryptedKey: options.key,
        status: "active",
        rateLimitedAt: null,
      });
    }
  }
}

class MockAiRequestRecorder implements AiRequestRecorder {
  recorded: any[] = [];
  async recordRequest(options: any) {
    this.recorded.push(options);
  }
}

describe("GeminiLLMProvider Resiliency", () => {
  let keyRepo: MockApiKeyRepository;
  let requestRecorder: MockAiRequestRecorder;
  let responses: { text?: string; error?: Error }[] = [];
  let calls: any[] = [];

  const schema = z.object({
    score: z.number(),
    feedbackVi: z.string(),
  });

  const testPrompt: Prompt<any> = {
    purpose: "grading",
    promptVersion: "1",
    schemaVersion: "grading",
    schema,
    modelKind: "fast",
    render: () => "Check",
    expectedShape: { score: "number", feedbackVi: "string" },
  };

  beforeEach(() => {
    keyRepo = new MockApiKeyRepository();
    requestRecorder = new MockAiRequestRecorder();
    responses = [];
    calls = [];
  });

  const getProvider = () => {
    return new GeminiLLMProvider(
      keyRepo,
      requestRecorder,
      undefined,
      async (callOpts) => {
        calls.push(callOpts);
        const resp = responses.shift();
        if (!resp) throw new Error("No mock response configured");
        if (resp.error) throw resp.error;
        return {
          text: resp.text ?? "",
          inputTokens: 10,
          outputTokens: 20,
        };
      }
    );
  };

  it("Test 1: Successful parse & return on first call", async () => {
    keyRepo.addKey({ key: "k-1", id: "key-1", isUserKey: false });
    responses.push({
      text: JSON.stringify({ score: 90, feedbackVi: "Tốt" }),
    });

    const provider = getProvider();
    const result = await provider.generateJson({
      userId: "u-1",
      prompt: testPrompt,
    });

    expect(result).toEqual({ score: 90, feedbackVi: "Tốt" });
    expect(calls.length).toBe(1);
    expect(calls[0].apiKey).toBe("k-1");
  });

  it("Test 2: Malformed JSON triggers repair prompt and succeeds", async () => {
    keyRepo.addKey({ key: "k-1", id: "key-1", isUserKey: false });
    responses.push({
      text: "This is not JSON at all",
    });
    responses.push({
      text: JSON.stringify({ score: 85, feedbackVi: "Sửa" }),
    });

    const provider = getProvider();
    const result = await provider.generateJson({
      userId: "u-1",
      prompt: testPrompt,
    });

    expect(result).toEqual({ score: 85, feedbackVi: "Sửa" });
    expect(calls.length).toBe(2);
    expect(calls[0].purpose).toBe("grading");
    expect(calls[1].purpose).toBe("repair");
  });

  it("Test 3: API key rate limit rotates keys", async () => {
    keyRepo.addKey({ key: "k-1", id: "key-1", isUserKey: false });
    keyRepo.addKey({ key: "k-2", id: "key-2", isUserKey: false });

    // First key call fails with rate limit error
    const rateLimitErr = new Error("RESOURCE_EXHAUSTED");
    responses.push({ error: rateLimitErr });

    // Second key call succeeds
    responses.push({
      text: JSON.stringify({ score: 95, feedbackVi: "Tốt" }),
    });

    const provider = getProvider();
    const result = await provider.generateJson({
      userId: "u-1",
      prompt: testPrompt,
    });

    const firstTriedApiKey = calls[0].apiKey;
    const secondTriedApiKey = calls[1].apiKey;
    const firstTriedKeyId = firstTriedApiKey === "k-1" ? "key-1" : "key-2";
    const secondTriedKeyId = firstTriedApiKey === "k-1" ? "key-2" : "key-1";

    expect(result).toEqual({ score: 95, feedbackVi: "Tốt" });
    expect(calls.length).toBe(2);
    expect(firstTriedApiKey).toBe(firstTriedApiKey);
    expect(secondTriedApiKey).toBe(
      secondTriedKeyId === "key-1" ? "k-1" : "k-2"
    );
    expect(
      (provider as any).apiRotationPool.isKeyModelCooldown(
        firstTriedKeyId,
        "gemini-3.1-flash-lite"
      )
    ).toBe(true);
    expect(
      (provider as any).apiRotationPool.isKeyModelCooldown(
        secondTriedKeyId,
        "gemini-3.1-flash-lite"
      )
    ).toBe(false);
  });

  it("Test 4: All keys exhausted for a model rotates model pool", async () => {
    const { ApiRotationPool } = await import("./api-rotation-pool");
    const customPool = new ApiRotationPool(
      keyRepo,
      ["model-analysis-1", "model-analysis-2"],
      ["model-fast-1", "model-fast-2"]
    );

    keyRepo.addKey({ key: "k-1", id: "key-1", isUserKey: false });

    // k-1 fails on model-fast-1 with rate limit
    responses.push({ error: new Error("RESOURCE_EXHAUSTED") });

    // k-1 succeeds on model-fast-2
    responses.push({
      text: JSON.stringify({ score: 100, feedbackVi: "Tốt" }),
    });

    const provider = new GeminiLLMProvider(
      keyRepo,
      requestRecorder,
      customPool,
      async (callOpts) => {
        calls.push(callOpts);
        const resp = responses.shift();
        if (!resp) throw new Error("No mock response configured");
        if (resp.error) throw resp.error;
        return {
          text: resp.text ?? "",
          inputTokens: 10,
          outputTokens: 20,
        };
      }
    );

    const result = await provider.generateJson({
      userId: "u-1",
      prompt: testPrompt,
    });

    expect(result).toEqual({ score: 100, feedbackVi: "Tốt" });
    expect(calls.length).toBe(2);
    expect(calls[0].model).toBe("model-fast-1");
    expect(calls[1].model).toBe("model-fast-2");
    expect(customPool.getCooldowns().map((c) => c.model)).toContain(
      "model-fast-1"
    );
  });

  it("Test 5: Metrics recorded with estimated costs", async () => {
    keyRepo.addKey({ key: "k-1", id: "key-1", isUserKey: false });
    responses.push({
      text: JSON.stringify({ score: 90, feedbackVi: "Tốt" }),
    });

    const provider = getProvider();
    await provider.generateJson({
      userId: "u-1",
      prompt: testPrompt,
    });

    expect(requestRecorder.recorded.length).toBe(1);
    const recorded = requestRecorder.recorded[0];
    expect(recorded.userId).toBe("u-1");
    expect(recorded.status).toBe("succeeded");
    expect(recorded.inputTokens).toBe(10);
    expect(recorded.outputTokens).toBe(20);
    expect(recorded.costMicros).toBeGreaterThan(0);
  });

  it("Test 6: Model rate limit allows using the same key on fallback model", async () => {
    const { ApiRotationPool } = await import("./api-rotation-pool");
    const customPool = new ApiRotationPool(
      keyRepo,
      ["model-analysis-1", "model-analysis-2"],
      ["model-fast-1", "model-fast-2"]
    );

    keyRepo.addKey({ key: "k-1", id: "key-1", isUserKey: false });

    // k-1 fails on model-fast-1 with rate limit
    responses.push({ error: new Error("RESOURCE_EXHAUSTED") });

    // k-1 succeeds on model-fast-2
    responses.push({
      text: JSON.stringify({ score: 100, feedbackVi: "Tốt" }),
    });

    const provider = new GeminiLLMProvider(
      keyRepo,
      requestRecorder,
      customPool,
      async (callOpts) => {
        calls.push(callOpts);
        const resp = responses.shift();
        if (!resp) throw new Error("No mock response configured");
        if (resp.error) throw resp.error;
        return {
          text: resp.text ?? "",
          inputTokens: 10,
          outputTokens: 20,
        };
      }
    );

    const result = await provider.generateJson({
      userId: "u-1",
      prompt: testPrompt,
    });

    expect(result).toEqual({ score: 100, feedbackVi: "Tốt" });
    expect(calls.length).toBe(2);
    expect(calls[0].model).toBe("model-fast-1");
    expect(calls[1].model).toBe("model-fast-2");
    expect(calls[0].apiKey).toBe("k-1");
    expect(calls[1].apiKey).toBe("k-1"); // Reuse key-1
    expect(customPool.isKeyModelCooldown("key-1", "model-fast-1")).toBe(true);
    expect(customPool.isKeyModelCooldown("key-1", "model-fast-2")).toBe(false);
  });
});

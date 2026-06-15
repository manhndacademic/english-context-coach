import { describe, expect, it, beforeEach } from "vitest";
import { z } from "zod";
import type { KeyResolver, AiRequestRecorder } from "../ports";
import type { LLMClient } from "./resiliency-manager";

// Mock implementations
class MockKeyResolver implements KeyResolver {
  keys: { key: string; id: string; isUserKey: boolean }[] = [];
  rateLimited = new Set<string>();
  invalid = new Set<string>();

  ignoreRateLimitInResolution = false;

  async resolveApiKeyWithExclusions(
    _userId?: string,
    excludedKeyIds?: Set<string>
  ) {
    const active = this.keys.filter(
      (k) =>
        (!excludedKeyIds || !excludedKeyIds.has(k.id)) &&
        (this.ignoreRateLimitInResolution || !this.rateLimited.has(k.id)) &&
        !this.invalid.has(k.id)
    );
    if (active.length === 0) {
      throw new Error("No keys available");
    }
    return active[0];
  }

  async markKeyRateLimited(keyId: string) {
    this.rateLimited.add(keyId);
  }

  async markKeyInvalid(keyId: string) {
    this.invalid.add(keyId);
  }

  async restoreKeyToActive(keyId: string) {
    this.rateLimited.delete(keyId);
    this.invalid.delete(keyId);
  }

  async saveUserApiKey() {}
}

class MockAiRequestRecorder implements AiRequestRecorder {
  recorded: any[] = [];
  async recordRequest(options: any) {
    this.recorded.push(options);
  }
}

class MockLLMClient implements LLMClient {
  calls: any[] = [];
  responses: { text?: string; error?: Error }[] = [];

  async call(options: any) {
    this.calls.push(options);
    const resp = this.responses.shift();
    if (!resp) throw new Error("No mock response configured");
    if (resp.error) throw resp.error;
    return {
      text: resp.text ?? "",
      inputTokens: 10,
      outputTokens: 20,
    };
  }
}

import { DefaultLLMResiliencyManager } from "./resiliency-manager";

describe("DefaultLLMResiliencyManager", () => {
  let keyResolver: MockKeyResolver;
  let requestRecorder: MockAiRequestRecorder;
  let manager: DefaultLLMResiliencyManager;
  let client: MockLLMClient;

  const schema = z.object({
    score: z.number(),
    feedbackVi: z.string(),
  });

  beforeEach(() => {
    keyResolver = new MockKeyResolver();
    requestRecorder = new MockAiRequestRecorder();
    manager = new DefaultLLMResiliencyManager(keyResolver, requestRecorder);
    client = new MockLLMClient();
  });

  it("Test 1: Successful parse & return on first call", async () => {
    keyResolver.keys.push({ key: "k-1", id: "key-1", isUserKey: false });
    client.responses.push({
      text: JSON.stringify({ score: 90, feedbackVi: "Tốt" }),
    });

    const result = await manager.execute(
      {
        userId: "u-1",
        purpose: "grading",
        prompt: "Check",
        promptVersion: "1",
        schemaVersion: "grading",
        schema,
        modelKind: "fast",
      },
      client
    );

    expect(result).toEqual({ score: 90, feedbackVi: "Tốt" });
    expect(client.calls.length).toBe(1);
    expect(client.calls[0].apiKey).toBe("k-1");
  });

  it("Test 2: Malformed JSON triggers repair prompt and succeeds", async () => {
    keyResolver.keys.push({ key: "k-1", id: "key-1", isUserKey: false });
    client.responses.push({
      text: "This is not JSON at all",
    });
    client.responses.push({
      text: JSON.stringify({ score: 85, feedbackVi: "Sửa" }),
    });

    const result = await manager.execute(
      {
        userId: "u-1",
        purpose: "grading",
        prompt: "Check",
        promptVersion: "1",
        schemaVersion: "grading",
        schema,
        modelKind: "fast",
      },
      client
    );

    expect(result).toEqual({ score: 85, feedbackVi: "Sửa" });
    expect(client.calls.length).toBe(2);
    expect(client.calls[0].purpose).toBe("grading");
    expect(client.calls[1].purpose).toBe("repair");
  });

  it("Test 3: API key rate limit rotates keys", async () => {
    keyResolver.keys.push({ key: "k-1", id: "key-1", isUserKey: false });
    keyResolver.keys.push({ key: "k-2", id: "key-2", isUserKey: false });

    // First key call fails with rate limit error
    const rateLimitErr = new Error("RESOURCE_EXHAUSTED");
    client.responses.push({ error: rateLimitErr });

    // Second key call succeeds
    client.responses.push({
      text: JSON.stringify({ score: 95, feedbackVi: "Tốt" }),
    });

    const result = await manager.execute(
      {
        userId: "u-1",
        purpose: "grading",
        prompt: "Check",
        promptVersion: "1",
        schemaVersion: "grading",
        schema,
        modelKind: "fast",
      },
      client
    );

    expect(result).toEqual({ score: 95, feedbackVi: "Tốt" });
    expect(client.calls.length).toBe(2);
    expect(client.calls[0].apiKey).toBe("k-1");
    expect(client.calls[1].apiKey).toBe("k-2");
    expect(keyResolver.rateLimited.has("key-1")).toBe(true);
  });

  it("Test 4: All keys exhausted for a model rotates model pool", async () => {
    const { ProviderRotationPool } = await import("./model-pool");
    const customPool = new ProviderRotationPool(
      ["model-analysis-1", "model-analysis-2"],
      ["model-fast-1", "model-fast-2"]
    );
    const customManager = new DefaultLLMResiliencyManager(
      keyResolver,
      requestRecorder,
      customPool
    );

    keyResolver.keys.push({ key: "k-1", id: "key-1", isUserKey: false });
    keyResolver.ignoreRateLimitInResolution = true;

    // k-1 fails on model-fast-1 with rate limit
    client.responses.push({ error: new Error("RESOURCE_EXHAUSTED") });

    // k-1 succeeds on model-fast-2
    client.responses.push({
      text: JSON.stringify({ score: 100, feedbackVi: "Tốt" }),
    });

    const result = await customManager.execute(
      {
        userId: "u-1",
        purpose: "grading",
        prompt: "Check",
        promptVersion: "1",
        schemaVersion: "grading",
        schema,
        modelKind: "fast",
      },
      client
    );

    expect(result).toEqual({ score: 100, feedbackVi: "Tốt" });
    expect(client.calls.length).toBe(2);
    expect(client.calls[0].model).toBe("model-fast-1");
    expect(client.calls[1].model).toBe("model-fast-2");
    expect(customPool.getCooldowns().map((c) => c.model)).toContain(
      "model-fast-1"
    );
  });

  it("Test 5: Metrics recorded with estimated costs", async () => {
    keyResolver.keys.push({ key: "k-1", id: "key-1", isUserKey: false });
    client.responses.push({
      text: JSON.stringify({ score: 90, feedbackVi: "Tốt" }),
    });

    await manager.execute(
      {
        userId: "u-1",
        purpose: "grading",
        prompt: "Check",
        promptVersion: "1",
        schemaVersion: "grading",
        schema,
        modelKind: "fast",
      },
      client
    );

    expect(requestRecorder.recorded.length).toBe(1);
    const recorded = requestRecorder.recorded[0];
    expect(recorded.userId).toBe("u-1");
    expect(recorded.status).toBe("succeeded");
    expect(recorded.inputTokens).toBe(10);
    expect(recorded.outputTokens).toBe(20);
    expect(recorded.costMicros).toBeGreaterThan(0);
  });
});

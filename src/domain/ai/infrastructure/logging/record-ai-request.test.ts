import { describe, expect, it, vi, beforeEach } from "vitest";
import { recordAiRequest } from "./record-ai-request";

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
}));

function mockChain(result: any) {
  const chain: any = {
    insert: () => chain,
    values: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("adapters/recordAiRequest", () => {
  let mockDbClient: any;

  beforeEach(() => {
    mockDbClient = {
      insert: vi.fn(),
    };
  });

  it("calls insert and values on database client successfully", async () => {
    mockDbClient.insert.mockReturnValueOnce(mockChain([]));

    const options = {
      userId: "user-1",
      purpose: "grading" as const,
      provider: "gemini",
      model: "gemini-1.5-flash",
      promptVersion: "1",
      schemaVersion: "grading",
      payloadHash: "hash-123",
      status: "succeeded" as const,
      latencyMs: 1500,
      inputTokens: 100,
      outputTokens: 200,
      costMicros: 15,
      errorClass: null,
      errorMessage: null,
    };

    await recordAiRequest(options, mockDbClient);

    expect(mockDbClient.insert).toHaveBeenCalled();
  });
});

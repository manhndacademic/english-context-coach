import { GoogleGenAI } from "@google/genai";
import { decryptApiKey } from "./lib/crypto";
import { db } from "./db";
import { aiApiKeys } from "./db/schema";

async function getApiKey(): Promise<string> {
  const [picked] = await db.select().from(aiApiKeys).limit(1);
  if (picked) {
    try {
      return decryptApiKey(picked.encryptedKey);
    } catch {}
  }
  return process.env.GEMINI_API_KEY || "";
}

async function runTest() {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error("API Key not found!");
    process.exit(1);
  }

  const model = "gemini-3.1-flash-lite";
  const ai = new GoogleGenAI({ apiKey });

  // A prompt that generates a moderate to large text response
  const prompt = "Write a detailed history of the city of Rome, from its mythological founding to the fall of the Western Empire. Make the response very long, around 800 words.";

  console.log(`Benchmarking model: ${model} with large output...`);
  const start = Date.now();
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  const duration = Date.now() - start;

  const inTokens = res.usageMetadata?.promptTokenCount ?? 0;
  const outTokens = res.usageMetadata?.candidatesTokenCount ?? 0;
  const tps = outTokens / (duration / 1000);

  console.log(`Latency: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log(`Input Tokens: ${inTokens}`);
  console.log(`Output Tokens: ${outTokens}`);
  console.log(`Tokens/Second (Output): ${tps.toFixed(2)} tokens/sec`);

  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

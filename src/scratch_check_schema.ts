import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
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

async function main() {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error("API Key not found!");
    process.exit(1);
  }

  const model = "gemini-3.1-flash-lite";
  const ai = new GoogleGenAI({ apiKey });

  const testSchema = z.object({
    title: z.string(),
    count: z.number(),
    tags: z.array(z.string()),
  });

  console.log("Calling Gemini with responseSchema set to a Zod schema...");
  const start = Date.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents: "Generate a list of 3 tags for the topic 'space travel' with a title and count.",
      config: {
        responseMimeType: "application/json",
        responseSchema: testSchema,
      },
    });
    const duration = Date.now() - start;
    console.log(`Success! Latency: ${duration}ms`);
    console.log("Response text:", res.text);
    console.log("Parsed JSON:", JSON.parse(res.text || "{}"));
  } catch (err: any) {
    console.error("Failed to generate content with Zod schema:", err.message || err);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

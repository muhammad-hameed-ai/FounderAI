import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

export const ai = new GoogleGenAI({ apiKey });

const MODEL = "gemini-2.5-flash";

export async function generateWithGemini(prompt: string, systemInstruction?: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      });
      return response.text ?? "";
    } catch (err: unknown) {
      attempts++;
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("quota") || err.message.includes("rate"));
      if (isRateLimit && attempts < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempts);
        logger.warn({ attempts, delay }, "Gemini rate limit hit, retrying");
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Gemini generation failed after max retries");
}

export async function generateTextWithGemini(prompt: string, systemInstruction?: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          maxOutputTokens: 8192,
        },
      });
      return response.text ?? "";
    } catch (err: unknown) {
      attempts++;
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("quota") || err.message.includes("rate"));
      if (isRateLimit && attempts < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempts);
        logger.warn({ attempts, delay }, "Gemini rate limit hit, retrying");
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Gemini text generation failed after max retries");
}

export async function generateEmbedding(text: string): Promise<number[]> {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: [{ role: "user", parts: [{ text }] }],
      });
      const embedding = response.embeddings?.[0]?.values;
      if (!embedding) {
        throw new Error("No embedding returned from Gemini");
      }
      return embedding;
    } catch (err: unknown) {
      attempts++;
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("quota") || err.message.includes("rate"));
      if (isRateLimit && attempts < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempts);
        logger.warn({ attempts, delay }, "Embedding rate limit hit, retrying");
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Embedding failed after max retries");
}

import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

export const ai = new GoogleGenAI({ apiKey });

const MODEL = "gemini-3.6-flash";
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const MAX_ATTEMPTS = 5;

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("quota") ||
    msg.includes("rate") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("overloaded")
  );
}

function retryDelay(attempt: number): number {
  // Exponential backoff: 2s, 4s, 8s, 16s
  return Math.min(2000 * Math.pow(2, attempt - 1), 20000);
}

export async function generateWithGemini(prompt: string, systemInstruction?: string): Promise<string> {
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
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
      if (isRetryableError(err) && attempts < MAX_ATTEMPTS) {
        const delay = retryDelay(attempts);
        logger.warn({ attempts, delay, err: (err as Error).message }, "Gemini unavailable, retrying");
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

  while (attempts < MAX_ATTEMPTS) {
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
      if (isRetryableError(err) && attempts < MAX_ATTEMPTS) {
        const delay = retryDelay(attempts);
        logger.warn({ attempts, delay, err: (err as Error).message }, "Gemini text unavailable, retrying");
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

  while (attempts < MAX_ATTEMPTS) {
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: [{ role: "user", parts: [{ text }] }],
        config: {
          outputDimensionality: 768,
        },
      });
      const embedding = response.embeddings?.[0]?.values;
      if (!embedding) {
        throw new Error("No embedding returned from Gemini");
      }
      return embedding;
    } catch (err: unknown) {
      attempts++;
      if (isRetryableError(err) && attempts < MAX_ATTEMPTS) {
        const delay = retryDelay(attempts);
        logger.warn({ attempts, delay, err: (err as Error).message }, "Embedding unavailable, retrying");
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Embedding failed after max retries");
}

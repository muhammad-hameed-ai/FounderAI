import { Router, type IRouter } from "express";
import { semanticSearch, listMemories } from "../lib/memory";
import { generateEmbedding } from "../lib/gemini";
import {
  RecallMemoryBody,
  ListMemoriesQueryParams,
  RecallMemoryResponse,
  ListMemoriesResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/memory/recall", async (req, res): Promise<void> => {
  const parsed = RecallMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query, sessionId, limit } = parsed.data;

  try {
    let results;
    try {
      const embedding = await generateEmbedding(query);
      // Pass original query text so fallback text search works correctly if vector search fails.
      results = await semanticSearch(embedding, limit ?? 10, sessionId ?? undefined, query);
    } catch (embeddingErr) {
      logger.warn({ embeddingErr }, "Embedding failed, using text search");
      results = await listMemories(sessionId ?? undefined, undefined, limit ?? 10);
    }

    res.json(RecallMemoryResponse.parse(results));
  } catch (err) {
    logger.error({ err }, "Memory recall failed");
    res.status(500).json({ error: "Memory recall failed" });
  }
});

router.get("/memory/list", async (req, res): Promise<void> => {
  const parsed = ListMemoriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sessionId, type, limit } = parsed.data;

  const results = await listMemories(sessionId ?? undefined, type ?? undefined, limit ?? 50);
  res.json(ListMemoriesResponse.parse(results));
});

export default router;

import { ObjectId } from "mongodb";
import { getMemoriesCollection } from "./mongodb";
import { logger } from "./logger";

export interface MemoryRecord {
  _id?: ObjectId;
  sessionId: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
}

export interface MemoryRecordOut {
  id: string;
  sessionId: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  score?: number | null;
  createdAt: string;
}

export async function saveMemory(
  sessionId: string,
  type: string,
  content: string,
  metadata?: Record<string, unknown>,
  embedding?: number[]
): Promise<string> {
  const collection = await getMemoriesCollection();
  const doc: MemoryRecord = {
    sessionId,
    type,
    content,
    metadata: metadata ?? {},
    embedding: embedding ?? [],
    createdAt: new Date().toISOString(),
  };
  const result = await collection.insertOne(doc);
  logger.info({ sessionId, type, id: result.insertedId.toString() }, "Memory saved");
  return result.insertedId.toString();
}

export async function semanticSearch(
  queryEmbedding: number[],
  limit: number = 10,
  sessionId?: string,
  fallbackQuery?: string   // original text query used when vector search fails
): Promise<MemoryRecordOut[]> {
  const collection = await getMemoriesCollection();

  try {
    const pipeline: object[] = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit,
          ...(sessionId ? { filter: { sessionId } } : {}),
        },
      },
      {
        $project: {
          _id: 1,
          sessionId: 1,
          type: 1,
          content: 1,
          metadata: 1,
          createdAt: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return results.map((r) => ({
      id: r._id.toString(),
      sessionId: r.sessionId,
      type: r.type,
      content: r.content,
      metadata: r.metadata ?? null,
      score: r.score ?? null,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    logger.warn({ err }, "Vector search failed, falling back to text search");
    // Use the original query text for text search; falls back to recent memories if empty.
    return fallbackTextSearch(fallbackQuery ?? "", limit, sessionId);
  }
}

export async function fallbackTextSearch(
  query: string,
  limit: number = 10,
  sessionId?: string
): Promise<MemoryRecordOut[]> {
  const collection = await getMemoriesCollection();
  const filter: Record<string, unknown> = {};
  if (sessionId) filter.sessionId = sessionId;
  if (query) filter.$text = { $search: query };

  const results = await collection
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return results.map((r) => ({
    id: r._id.toString(),
    sessionId: r.sessionId,
    type: r.type,
    content: r.content,
    metadata: r.metadata ?? null,
    score: null,
    createdAt: r.createdAt,
  }));
}

export async function listMemories(
  sessionId?: string,
  type?: string,
  limit: number = 50
): Promise<MemoryRecordOut[]> {
  const collection = await getMemoriesCollection();
  const filter: Record<string, unknown> = {};
  if (sessionId) filter.sessionId = sessionId;
  if (type) filter.type = type;

  const results = await collection
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return results.map((r) => ({
    id: r._id.toString(),
    sessionId: r.sessionId,
    type: r.type,
    content: r.content,
    metadata: r.metadata ?? null,
    score: null,
    createdAt: r.createdAt,
  }));
}

export async function countMemoriesForSession(sessionId: string): Promise<number> {
  const collection = await getMemoriesCollection();
  return collection.countDocuments({ sessionId });
}

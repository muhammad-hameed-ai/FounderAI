import { Router, type IRouter } from "express";
import { ObjectId } from "mongodb";
import { getSessionsCollection } from "../lib/mongodb";
import { countMemoriesForSession } from "../lib/memory";
import {
  CreateSessionBody,
  GetSessionParams,
  DeleteSessionParams,
  RunAgentsParams,
  GetSessionStatusParams,
  ListSessionsResponse,
  GetSessionResponse,
  DeleteSessionResponse,
  GetSessionStatusResponse,
  GetDashboardStatsResponse,
} from "@workspace/api-zod";
import { runOrchestratorAgent } from "../lib/agents/orchestrator";
import { runResearchAgent } from "../lib/agents/research";
import { runBusinessPlanAgent } from "../lib/agents/businessPlan";
import { runMvpBuilderAgent } from "../lib/agents/mvpBuilder";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function toSessionOut(doc: Record<string, unknown>) {
  return {
    id: (doc._id as ObjectId).toString(),
    title: doc.title as string,
    idea: doc.idea as string,
    status: doc.status as string,
    createdAt: doc.createdAt as string,
    updatedAt: (doc.updatedAt as string | null) ?? null,
    agentProgress: (doc.agentProgress as Record<string, string> | null) ?? null,
  };
}

function toSessionDetailOut(doc: Record<string, unknown>) {
  return {
    id: (doc._id as ObjectId).toString(),
    title: doc.title as string,
    idea: doc.idea as string,
    status: doc.status as string,
    createdAt: doc.createdAt as string,
    updatedAt: (doc.updatedAt as string | null) ?? null,
    agentProgress: (doc.agentProgress as Record<string, string> | null) ?? null,
    orchestratorResult: (doc.orchestratorResult as Record<string, unknown> | null) ?? null,
    researchResult: (doc.researchResult as Record<string, unknown> | null) ?? null,
    businessPlanResult: (doc.businessPlanResult as Record<string, unknown> | null) ?? null,
    mvpResult: (doc.mvpResult as Record<string, unknown> | null) ?? null,
    gitlabUrl: (doc.gitlabUrl as string | null) ?? null,
    memoryCount: (doc.memoryCount as number | null) ?? null,
  };
}

router.get("/sessions", async (req, res): Promise<void> => {
  const collection = await getSessionsCollection();
  const docs = await collection.find({}).sort({ createdAt: -1 }).limit(100).toArray();
  const sessions = docs.map((d) => toSessionOut(d as Record<string, unknown>));
  res.json(ListSessionsResponse.parse(sessions));
});

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const collection = await getSessionsCollection();
  const now = new Date().toISOString();
  const doc = {
    title: "Analyzing...",
    idea: parsed.data.idea,
    status: "pending",
    createdAt: now,
    updatedAt: null,
    agentProgress: {
      orchestrator: "pending",
      research: "pending",
      businessPlan: "pending",
      mvpBuilder: "pending",
    },
    orchestratorResult: null,
    researchResult: null,
    businessPlanResult: null,
    mvpResult: null,
    gitlabUrl: null,
    memoryCount: null,
  };

  const result = await collection.insertOne(doc);
  const inserted = await collection.findOne({ _id: result.insertedId });
  res.status(201).json(toSessionOut(inserted as Record<string, unknown>));
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(rawId);
  } catch {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const collection = await getSessionsCollection();
  const doc = await collection.findOne({ _id: objectId });

  if (!doc) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const memoryCount = await countMemoriesForSession(rawId);
  const out = toSessionDetailOut({ ...doc, memoryCount } as Record<string, unknown>);
  res.json(GetSessionResponse.parse(out));
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(rawId);
  } catch {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const collection = await getSessionsCollection();
  const result = await collection.deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(DeleteSessionResponse.parse({ success: true, message: "Session deleted" }));
});

router.post("/sessions/:id/run", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(rawId);
  } catch {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const collection = await getSessionsCollection();
  const doc = await collection.findOne({ _id: objectId });

  if (!doc) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (doc.status === "running") {
    res.status(409).json({ error: "Agents already running for this session" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const updateProgress = async (
    agent: string,
    status: string,
    extra?: Record<string, unknown>
  ) => {
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          [`agentProgress.${agent}`]: status,
          updatedAt: new Date().toISOString(),
          ...extra,
        },
      }
    );
    sendEvent({ agent, status, ...extra });
  };

  await collection.updateOne(
    { _id: objectId },
    { $set: { status: "running", updatedAt: new Date().toISOString() } }
  );
  sendEvent({ type: "started", sessionId: rawId });

  const sendLog = (agent: string, message: string) => {
    sendEvent({ type: "log", agent, message, ts: Date.now() });
  };

  try {
    // Smart resume: skip agents that already completed
    const progress = (doc.agentProgress as Record<string, string>) ?? {};

    let orchestratorResult = doc.orchestratorResult as Awaited<ReturnType<typeof runOrchestratorAgent>> | null;
    if (progress.orchestrator === "done" && orchestratorResult) {
      sendEvent({ agent: "orchestrator", status: "done" });
      sendLog("orchestrator", "Skipped — already completed.");
    } else {
      await updateProgress("orchestrator", "running");
      orchestratorResult = await runOrchestratorAgent(rawId, doc.idea as string, (msg) => sendLog("orchestrator", msg));
      await updateProgress("orchestrator", "done", { orchestratorResult, title: orchestratorResult.title });
      await collection.updateOne({ _id: objectId }, { $set: { title: orchestratorResult.title } });
    }

    let researchResult = doc.researchResult as Awaited<ReturnType<typeof runResearchAgent>> | null;
    if (progress.research === "done" && researchResult) {
      sendEvent({ agent: "research", status: "done" });
      sendLog("research", "Skipped — already completed.");
    } else {
      await updateProgress("research", "running");
      researchResult = await runResearchAgent(rawId, doc.idea as string, orchestratorResult!, (msg) => sendLog("research", msg));
      await updateProgress("research", "done", { researchResult });
    }

    let businessPlanResult = doc.businessPlanResult as Awaited<ReturnType<typeof runBusinessPlanAgent>> | null;
    if (progress.businessPlan === "done" && businessPlanResult) {
      sendEvent({ agent: "businessPlan", status: "done" });
      sendLog("businessPlan", "Skipped — already completed.");
    } else {
      await updateProgress("businessPlan", "running");
      businessPlanResult = await runBusinessPlanAgent(rawId, doc.idea as string, orchestratorResult!, researchResult!, (msg) => sendLog("businessPlan", msg));
      await updateProgress("businessPlan", "done", { businessPlanResult });
    }

    let mvpResult: Awaited<ReturnType<typeof runMvpBuilderAgent>> | null = null;
    if (progress.mvpBuilder === "done" && doc.mvpResult) {
      mvpResult = doc.mvpResult as Awaited<ReturnType<typeof runMvpBuilderAgent>>;
      sendEvent({ agent: "mvpBuilder", status: "done" });
      sendLog("mvpBuilder", "Skipped — already completed.");
    } else {
      await updateProgress("mvpBuilder", "running");
      mvpResult = await runMvpBuilderAgent(rawId, doc.idea as string, orchestratorResult!, (msg) => sendLog("mvpBuilder", msg));
      await updateProgress("mvpBuilder", "done", { mvpResult, gitlabUrl: mvpResult.gitlabUrl });
    }

    const memoryCount = await countMemoriesForSession(rawId);
    await collection.updateOne(
      { _id: objectId },
      { $set: { status: "completed", memoryCount, updatedAt: new Date().toISOString() } }
    );
    sendEvent({ type: "completed", sessionId: rawId, memoryCount });
  } catch (err) {
    logger.error({ err, sessionId: rawId }, "Agent run failed");
    await collection.updateOne(
      { _id: objectId },
      { $set: { status: "failed", updatedAt: new Date().toISOString() } }
    );
    sendEvent({ type: "error", message: err instanceof Error ? err.message : "Agent run failed" });
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/sessions/:id/stop", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(rawId);
  } catch {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const collection = await getSessionsCollection();
  const doc = await collection.findOne({ _id: objectId });

  if (!doc) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const progress = (doc.agentProgress as Record<string, string>) ?? {};
  const updatedProgress: Record<string, string> = {};
  for (const [agent, status] of Object.entries(progress)) {
    updatedProgress[`agentProgress.${agent}`] = status === "running" ? "failed" : status;
  }

  await collection.updateOne(
    { _id: objectId },
    { $set: { status: "failed", updatedAt: new Date().toISOString(), ...updatedProgress } }
  );

  res.json({ success: true, message: "Session stopped" });
});

router.get("/sessions/:id/status", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(rawId);
  } catch {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const collection = await getSessionsCollection();
  const doc = await collection.findOne({ _id: objectId });

  if (!doc) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(
    GetSessionStatusResponse.parse({
      sessionId: rawId,
      status: doc.status,
      agentProgress: doc.agentProgress ?? null,
      error: null,
    })
  );
});

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  try {
    const collection = await getSessionsCollection();

    const [total, completed, withGitlab, recentDocs] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ status: "completed" }),
      collection.countDocuments({ gitlabUrl: { $ne: null } }),
      collection.find({}).sort({ createdAt: -1 }).limit(5).toArray(),
    ]);

    const { getMemoriesCollection } = await import("../lib/mongodb");
    const memoriesCollection = await getMemoriesCollection();
    const totalMemories = await memoriesCollection.countDocuments({});

    const recentSessions = recentDocs.map((d) => toSessionOut(d as Record<string, unknown>));

    res.json(
      GetDashboardStatsResponse.parse({
        totalSessions: total,
        completedSessions: completed,
        totalMemories,
        gitlabRepos: withGitlab,
        recentSessions,
      })
    );
  } catch (err) {
    req.log.error({ err }, "Dashboard stats failed");
    res.json(
      GetDashboardStatsResponse.parse({
        totalSessions: 0,
        completedSessions: 0,
        totalMemories: 0,
        gitlabRepos: 0,
        recentSessions: [],
      })
    );
  }
});

export default router;

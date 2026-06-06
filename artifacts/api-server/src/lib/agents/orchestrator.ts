import { generateWithGemini, generateEmbedding } from "../gemini";
import { saveMemory } from "../memory";
import { logger } from "../logger";

export interface OrchestratorResult {
  title: string;
  summary: string;
  problemStatement: string;
  targetMarket: string;
  valueProposition: string;
  revenueModel: string;
  keyRisks: string[];
  techStack: string[];
  nextSteps: string[];
}

export async function runOrchestratorAgent(
  sessionId: string,
  idea: string,
  onLog?: (msg: string) => void
): Promise<OrchestratorResult> {
  logger.info({ sessionId }, "Running Orchestrator Agent");
  onLog?.("Analyzing startup idea...");

  const prompt = `You are the Orchestrator Agent for FounderAI. Analyze this startup idea and decompose it into a structured JSON object.

Startup idea: "${idea}"

Return a JSON object with these exact fields:
{
  "title": "concise startup name (2-4 words)",
  "summary": "one paragraph executive summary",
  "problemStatement": "clear description of the problem being solved",
  "targetMarket": "specific description of target customers",
  "valueProposition": "unique value this startup delivers",
  "revenueModel": "how this startup makes money",
  "keyRisks": ["risk 1", "risk 2", "risk 3"],
  "techStack": ["technology 1", "technology 2"],
  "nextSteps": ["step 1", "step 2", "step 3", "step 4"]
}

Be specific, realistic, and insightful. Return only valid JSON.`;

  onLog?.("Calling Gemini 2.5 Flash for idea analysis...");
  const raw = await generateWithGemini(prompt);
  onLog?.("Response received — parsing JSON...");

  let result: OrchestratorResult;
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse orchestrator result");
    throw new Error("Orchestrator agent returned invalid JSON");
  }

  onLog?.(`Startup named: "${result.title}"`);
  onLog?.(`Problem: ${result.problemStatement.slice(0, 120)}...`);
  onLog?.(`Target market: ${result.targetMarket.slice(0, 100)}...`);
  onLog?.(`Tech stack: ${result.techStack.join(", ")}`);
  onLog?.("Generating embedding and saving to MongoDB...");

  const memoryContent = `${result.title}: ${result.summary} Problem: ${result.problemStatement} Value: ${result.valueProposition}`;
  const embedding = await generateEmbedding(memoryContent).catch(() => []);
  await saveMemory(sessionId, "orchestrator", memoryContent, {
    title: result.title,
    problemStatement: result.problemStatement,
  }, embedding);

  onLog?.("Memory saved to vector store. Orchestrator complete ✓");
  logger.info({ sessionId, title: result.title }, "Orchestrator Agent complete");
  return result;
}

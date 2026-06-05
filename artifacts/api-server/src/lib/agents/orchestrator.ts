import { generateWithGemini } from "../gemini";
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

export async function runOrchestratorAgent(sessionId: string, idea: string): Promise<OrchestratorResult> {
  logger.info({ sessionId }, "Running Orchestrator Agent");

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

  const raw = await generateWithGemini(prompt);
  let result: OrchestratorResult;

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse orchestrator result");
    throw new Error("Orchestrator agent returned invalid JSON");
  }

  await saveMemory(sessionId, "orchestrator", JSON.stringify(result), {
    title: result.title,
    problemStatement: result.problemStatement,
  });

  logger.info({ sessionId, title: result.title }, "Orchestrator Agent complete");
  return result;
}

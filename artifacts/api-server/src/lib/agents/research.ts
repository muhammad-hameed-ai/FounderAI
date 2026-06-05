import { generateWithGemini, generateEmbedding } from "../gemini";
import { saveMemory } from "../memory";
import { logger } from "../logger";
import type { OrchestratorResult } from "./orchestrator";

export interface Competitor {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  fundingStage: string;
}

export interface ResearchResult {
  marketSize: string;
  marketGrowthRate: string;
  marketTrends: string[];
  competitors: Competitor[];
  competitiveAdvantage: string;
  targetCustomerInsights: string;
  keyInsights: string[];
  goToMarketStrategy: string;
  regulatoryConsiderations: string;
}

export async function runResearchAgent(
  sessionId: string,
  idea: string,
  orchestratorResult: OrchestratorResult
): Promise<ResearchResult> {
  logger.info({ sessionId }, "Running Market Research Agent");

  const prompt = `You are a Market Research Agent for FounderAI. Conduct comprehensive market research for this startup.

Startup: "${orchestratorResult.title}"
Idea: "${idea}"
Target Market: "${orchestratorResult.targetMarket}"
Value Proposition: "${orchestratorResult.valueProposition}"

Return a JSON object with this exact structure:
{
  "marketSize": "specific market size with dollar amount (e.g. $4.2B TAM)",
  "marketGrowthRate": "annual growth rate (e.g. 18% CAGR)",
  "marketTrends": ["trend 1", "trend 2", "trend 3", "trend 4"],
  "competitors": [
    {
      "name": "Competitor Name",
      "description": "what they do",
      "strengths": ["strength 1", "strength 2"],
      "weaknesses": ["weakness 1", "weakness 2"],
      "fundingStage": "Seed/Series A/Series B/Public/etc"
    }
  ],
  "competitiveAdvantage": "what makes this startup's approach better",
  "targetCustomerInsights": "deep insight about target customer behavior and needs",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "goToMarketStrategy": "recommended go-to-market approach",
  "regulatoryConsiderations": "any regulatory or compliance considerations"
}

Include 3-5 realistic competitors. Be specific with market data. Return only valid JSON.`;

  const raw = await generateWithGemini(prompt);
  let result: ResearchResult;

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse research result");
    throw new Error("Research agent returned invalid JSON");
  }

  const researchContent = `Market Research for ${orchestratorResult.title}: Market size ${result.marketSize}, growth ${result.marketGrowthRate}. ${result.competitors.length} competitors analyzed. Key insight: ${result.keyInsights[0] ?? ""}. Competitive advantage: ${result.competitiveAdvantage}`;
  const researchEmbedding = await generateEmbedding(researchContent).catch(() => []);
  await saveMemory(
    sessionId,
    "research",
    researchContent,
    { marketSize: result.marketSize, competitorCount: result.competitors.length }
  , researchEmbedding);

  for (const competitor of result.competitors) {
    const compContent = `Competitor: ${competitor.name} - ${competitor.description}. Strengths: ${competitor.strengths.join(", ")}. Weaknesses: ${competitor.weaknesses.join(", ")}`;
    const compEmbedding = await generateEmbedding(compContent).catch(() => []);
    await saveMemory(
      sessionId,
      "competitor",
      compContent,
      { competitorName: competitor.name, fundingStage: competitor.fundingStage },
      compEmbedding
    );
  }

  for (const insight of result.keyInsights) {
    const insightEmbedding = await generateEmbedding(insight).catch(() => []);
    await saveMemory(sessionId, "insight", insight, {
      source: "market_research",
      startup: orchestratorResult.title,
    }, insightEmbedding);
  }

  logger.info({ sessionId, competitors: result.competitors.length }, "Research Agent complete");
  return result;
}

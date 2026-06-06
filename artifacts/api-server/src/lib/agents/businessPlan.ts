import { generateWithGemini, generateEmbedding } from "../gemini";
import { saveMemory } from "../memory";
import { logger } from "../logger";
import type { OrchestratorResult } from "./orchestrator";
import type { ResearchResult } from "./research";

export interface FinancialProjection {
  year: number;
  revenue: string;
  users: string;
  burnRate: string;
}

export interface BusinessPlanResult {
  executiveSummary: string;
  missionStatement: string;
  productDescription: string;
  businessModel: string;
  pricingStrategy: string;
  salesStrategy: string;
  marketingStrategy: string;
  operationalPlan: string;
  teamRequirements: string[];
  financialProjections: FinancialProjection[];
  fundingRequirements: string;
  useOfFunds: string[];
  milestones: { timeline: string; milestone: string }[];
  riskMitigation: { risk: string; mitigation: string }[];
}

export async function runBusinessPlanAgent(
  sessionId: string,
  idea: string,
  orchestratorResult: OrchestratorResult,
  researchResult: ResearchResult,
  onLog?: (msg: string) => void
): Promise<BusinessPlanResult> {
  logger.info({ sessionId }, "Running Business Plan Agent");
  onLog?.(`Building investor-ready business plan for "${orchestratorResult.title}"...`);

  const prompt = `You are a Business Plan Agent for FounderAI. Create a comprehensive, investor-ready business plan.

Startup: "${orchestratorResult.title}"
Idea: "${idea}"
Market Size: "${researchResult.marketSize}"
Market Growth: "${researchResult.marketGrowthRate}"
Revenue Model: "${orchestratorResult.revenueModel}"
Value Proposition: "${orchestratorResult.valueProposition}"
Target Market: "${orchestratorResult.targetMarket}"
Go-to-market: "${researchResult.goToMarketStrategy}"

Return a JSON object with this exact structure:
{
  "executiveSummary": "compelling 2-3 paragraph executive summary for investors",
  "missionStatement": "concise mission statement",
  "productDescription": "detailed product/service description",
  "businessModel": "how the business operates and creates value",
  "pricingStrategy": "specific pricing tiers and rationale",
  "salesStrategy": "B2B/B2C sales approach",
  "marketingStrategy": "detailed marketing and growth strategy",
  "operationalPlan": "key operational requirements and processes",
  "teamRequirements": ["role 1", "role 2", "role 3", "role 4"],
  "financialProjections": [
    { "year": 1, "revenue": "$X", "users": "X", "burnRate": "$X/month" },
    { "year": 2, "revenue": "$X", "users": "X", "burnRate": "$X/month" },
    { "year": 3, "revenue": "$X", "users": "X", "burnRate": "$X/month" }
  ],
  "fundingRequirements": "total funding needed and stage",
  "useOfFunds": ["allocation 1 with percentage", "allocation 2 with percentage"],
  "milestones": [
    { "timeline": "Month 3", "milestone": "description" },
    { "timeline": "Month 6", "milestone": "description" },
    { "timeline": "Year 1", "milestone": "description" },
    { "timeline": "Year 2", "milestone": "description" }
  ],
  "riskMitigation": [
    { "risk": "risk description", "mitigation": "mitigation strategy" },
    { "risk": "risk description", "mitigation": "mitigation strategy" },
    { "risk": "risk description", "mitigation": "mitigation strategy" }
  ]
}

Be specific, realistic, and compelling. Return only valid JSON.`;

  onLog?.("Calling Gemini 2.5 Flash to draft business plan...");
  const raw = await generateWithGemini(prompt);
  onLog?.("Response received — parsing business plan...");

  let result: BusinessPlanResult;
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse business plan result");
    throw new Error("Business Plan agent returned invalid JSON");
  }

  onLog?.(`Mission: "${result.missionStatement}"`);
  onLog?.(`Funding required: ${result.fundingRequirements}`);
  onLog?.(`Financial projections: Y1 ${result.financialProjections[0]?.revenue ?? "N/A"} → Y2 ${result.financialProjections[1]?.revenue ?? "N/A"} → Y3 ${result.financialProjections[2]?.revenue ?? "N/A"}`);
  onLog?.(`${result.milestones.length} milestones defined. Team needs: ${result.teamRequirements.slice(0, 3).join(", ")}...`);
  onLog?.("Saving business plan to MongoDB vector store...");

  const planContent = `Business Plan for ${orchestratorResult.title}: ${result.executiveSummary.substring(0, 300)}. Mission: ${result.missionStatement}. Funding: ${result.fundingRequirements}. Year 1 revenue: ${result.financialProjections[0]?.revenue ?? "N/A"}`;
  const planEmbedding = await generateEmbedding(planContent).catch(() => []);
  await saveMemory(sessionId, "business_plan", planContent, {
    fundingRequirements: result.fundingRequirements,
    year1Revenue: result.financialProjections[0]?.revenue,
    missionStatement: result.missionStatement,
  }, planEmbedding);

  onLog?.("Business plan saved. Agent complete ✓");
  logger.info({ sessionId }, "Business Plan Agent complete");
  return result;
}

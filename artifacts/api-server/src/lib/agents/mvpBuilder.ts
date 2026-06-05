import { generateWithGemini, generateTextWithGemini } from "../gemini";
import { saveMemory } from "../memory";
import { logger } from "../logger";
import type { OrchestratorResult } from "./orchestrator";

export interface CodeFile {
  filename: string;
  language: string;
  content: string;
  description: string;
}

export interface MvpResult {
  repoName: string;
  description: string;
  techStack: string[];
  architecture: string;
  features: string[];
  codeFiles: CodeFile[];
  setupInstructions: string[];
  gitlabUrl: string | null;
}

async function createGitlabRepo(
  repoName: string,
  description: string
): Promise<{ id: number; webUrl: string; defaultBranch: string } | null> {
  const token = process.env.GITLAB_TOKEN;
  const username = process.env.GITLAB_USERNAME;

  if (!token || !username) {
    logger.warn("GITLAB_TOKEN or GITLAB_USERNAME not set, skipping repo creation");
    return null;
  }

  try {
    const response = await fetch("https://gitlab.com/api/v4/projects", {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoName,
        description,
        visibility: "public",
        initialize_with_readme: true,
        default_branch: "main",
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logger.error({ status: response.status, body: errBody }, "GitLab repo creation failed");
      return null;
    }

    const data = (await response.json()) as { id: number; web_url: string; default_branch: string };
    return { id: data.id, webUrl: data.web_url, defaultBranch: data.default_branch };
  } catch (err) {
    logger.error({ err }, "GitLab API call failed");
    return null;
  }
}

async function commitFileToGitlab(
  projectId: number,
  filePath: string,
  content: string,
  commitMessage: string,
  branch: string = "main"
): Promise<boolean> {
  const token = process.env.GITLAB_TOKEN;
  if (!token) return false;

  try {
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
      {
        method: "POST",
        headers: {
          "PRIVATE-TOKEN": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branch,
          content,
          commit_message: commitMessage,
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      logger.warn({ status: response.status, body, filePath }, "Failed to commit file to GitLab");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, filePath }, "GitLab commit failed");
    return false;
  }
}

export async function runMvpBuilderAgent(
  sessionId: string,
  idea: string,
  orchestratorResult: OrchestratorResult
): Promise<MvpResult> {
  logger.info({ sessionId }, "Running MVP Builder Agent");

  const prompt = `You are an MVP Builder Agent for FounderAI. Generate production-quality MVP code files for this startup.

Startup: "${orchestratorResult.title}"
Idea: "${idea}"
Recommended Tech Stack: ${orchestratorResult.techStack.join(", ")}
Problem: "${orchestratorResult.problemStatement}"
Value Proposition: "${orchestratorResult.valueProposition}"

Generate a realistic MVP with actual working code. Return JSON with this structure:
{
  "repoName": "kebab-case-repo-name",
  "description": "one line description for the GitLab repo",
  "techStack": ["technology 1", "technology 2", "technology 3"],
  "architecture": "description of the system architecture",
  "features": ["feature 1", "feature 2", "feature 3", "feature 4"],
  "codeFiles": [
    {
      "filename": "path/to/file.ext",
      "language": "python/javascript/typescript/etc",
      "content": "actual working code here",
      "description": "what this file does"
    }
  ],
  "setupInstructions": ["step 1", "step 2", "step 3"]
}

Generate 4-6 real code files including: README.md, main application file, requirements/package.json, and key feature files. Make the code actually functional and production-quality. Return only valid JSON.`;

  const raw = await generateWithGemini(prompt);
  let result: Omit<MvpResult, "gitlabUrl">;

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse MVP builder result");
    throw new Error("MVP Builder agent returned invalid JSON");
  }

  let gitlabUrl: string | null = null;

  const repoData = await createGitlabRepo(result.repoName, result.description);

  if (repoData) {
    logger.info({ sessionId, repoUrl: repoData.webUrl }, "GitLab repo created");

    for (const file of result.codeFiles) {
      const success = await commitFileToGitlab(
        repoData.id,
        file.filename,
        file.content,
        `feat: add ${file.filename} - ${file.description}`,
        repoData.defaultBranch
      );
      if (success) {
        logger.info({ sessionId, filename: file.filename }, "File committed to GitLab");
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    gitlabUrl = repoData.webUrl;
  }

  const finalResult: MvpResult = { ...result, gitlabUrl };

  await saveMemory(
    sessionId,
    "mvp",
    `MVP for ${orchestratorResult.title}: ${result.features.length} features, ${result.codeFiles.length} code files generated. Tech stack: ${result.techStack.join(", ")}. GitLab: ${gitlabUrl ?? "not created"}`,
    {
      repoName: result.repoName,
      gitlabUrl,
      fileCount: result.codeFiles.length,
      techStack: result.techStack,
    }
  );

  logger.info({ sessionId, gitlabUrl }, "MVP Builder Agent complete");
  return finalResult;
}

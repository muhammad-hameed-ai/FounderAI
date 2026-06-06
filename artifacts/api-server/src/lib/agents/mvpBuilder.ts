import { generateTextWithGemini, generateEmbedding } from "../gemini";
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

function extractJson(raw: string): string {
  // Strip markdown code fences
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Find outermost { ... }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return cleaned;
}

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    return null;
  }
}

function fallbackMvpResult(title: string): Omit<MvpResult, "gitlabUrl"> {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    repoName: `${slug}-mvp`,
    description: `MVP for ${title}`,
    techStack: ["Node.js", "React", "MongoDB"],
    architecture: "Full-stack web application with REST API backend and React frontend",
    features: [
      "User authentication and onboarding",
      "Core product functionality",
      "Dashboard and analytics",
      "API integrations",
    ],
    codeFiles: [
      {
        filename: "README.md",
        language: "markdown",
        content: `# ${title} MVP\n\nAI-generated MVP starter.\n\n## Setup\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
        description: "Project readme",
      },
      {
        filename: "package.json",
        language: "json",
        content: JSON.stringify({
          name: slug,
          version: "0.1.0",
          scripts: { dev: "node server.js", start: "node server.js" },
          dependencies: { express: "^4.18.0", cors: "^2.8.5" },
        }, null, 2),
        description: "Node dependencies",
      },
      {
        filename: "server.js",
        language: "javascript",
        content: `const express = require('express');\nconst cors = require('cors');\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\napp.get('/api/health', (req, res) => res.json({ status: 'ok', app: '${title}' }));\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(\`${title} running on port \${PORT}\`));\n`,
        description: "Express server entry point",
      },
    ],
    setupInstructions: [
      "Clone the repository",
      "Run `npm install`",
      "Run `npm run dev` to start development server",
      "Open http://localhost:3000",
    ],
  };
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
      headers: { "PRIVATE-TOKEN": token, "Content-Type": "application/json" },
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
        headers: { "PRIVATE-TOKEN": token, "Content-Type": "application/json" },
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
  orchestratorResult: OrchestratorResult,
  onLog?: (msg: string) => void
): Promise<MvpResult> {
  logger.info({ sessionId }, "Running MVP Builder Agent");
  onLog?.(`Generating MVP code for "${orchestratorResult.title}"...`);
  onLog?.(`Tech stack: ${orchestratorResult.techStack.slice(0, 3).join(", ")}`);

  const prompt = `You are an MVP Builder Agent. Generate a minimal but functional MVP for this startup.

Startup: "${orchestratorResult.title}"
Idea: "${idea}"
Tech Stack: ${orchestratorResult.techStack.slice(0, 3).join(", ")}

Return ONLY valid JSON with this exact structure (keep code concise, max 30 lines per file):
{
  "repoName": "kebab-case-name",
  "description": "one line repo description",
  "techStack": ["tech1", "tech2", "tech3"],
  "architecture": "one paragraph architecture description",
  "features": ["feature 1", "feature 2", "feature 3", "feature 4"],
  "codeFiles": [
    {
      "filename": "README.md",
      "language": "markdown",
      "content": "# Title\\n\\nDescription\\n\\n## Setup\\n\\nnpm install && npm start",
      "description": "Project readme"
    },
    {
      "filename": "package.json",
      "language": "json",
      "content": "{\\"name\\": \\"app\\", \\"version\\": \\"0.1.0\\", \\"scripts\\": {\\"start\\": \\"node server.js\\"}, \\"dependencies\\": {\\"express\\": \\"^4.18.0\\"}}",
      "description": "Dependencies"
    },
    {
      "filename": "server.js",
      "language": "javascript",
      "content": "const express = require('express');\\nconst app = express();\\napp.get('/', (req, res) => res.json({status: 'ok'}));\\napp.listen(3000);",
      "description": "Main server"
    }
  ],
  "setupInstructions": ["npm install", "npm start", "Open http://localhost:3000"]
}

IMPORTANT: Keep file content short. Escape all quotes and newlines in JSON strings. Return only the JSON object, no markdown.`;

  onLog?.("Calling Gemini 2.5 Flash for code generation...");
  const raw = await generateTextWithGemini(prompt);
  onLog?.("Response received — parsing MVP structure...");

  let result = safeParseJson<Omit<MvpResult, "gitlabUrl">>(raw);

  if (!result || !result.repoName || !Array.isArray(result.codeFiles)) {
    logger.warn({ sessionId, rawLength: raw.length }, "MVP JSON parse failed, using fallback");
    onLog?.("JSON parse failed — using fallback MVP skeleton...");
    result = fallbackMvpResult(orchestratorResult.title);
  }

  onLog?.(`Repo: ${result.repoName} | ${result.codeFiles.length} files | ${result.features.length} features`);
  onLog?.(`Architecture: ${result.architecture.slice(0, 120)}...`);
  logger.info({ sessionId, repoName: result.repoName, files: result.codeFiles.length }, "MVP code generated");

  let gitlabUrl: string | null = null;
  const repoData = await createGitlabRepo(result.repoName, result.description);

  if (repoData) {
    onLog?.(`GitLab repo created: ${repoData.webUrl}`);
    logger.info({ sessionId, repoUrl: repoData.webUrl }, "GitLab repo created");

    for (const file of result.codeFiles) {
      onLog?.(`Committing ${file.filename}...`);
      const success = await commitFileToGitlab(
        repoData.id,
        file.filename,
        file.content,
        `feat: add ${file.filename}`,
        repoData.defaultBranch
      );
      if (success) {
        onLog?.(`✓ ${file.filename} committed`);
        logger.info({ sessionId, filename: file.filename }, "File committed to GitLab");
      } else {
        onLog?.(`⚠ Failed to commit ${file.filename}`);
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    gitlabUrl = repoData.webUrl;
  } else {
    onLog?.("GitLab repo creation skipped (token not set or API error).");
  }

  const finalResult: MvpResult = { ...result, gitlabUrl };

  onLog?.("Saving MVP memory to MongoDB vector store...");
  const mvpContent = `MVP for ${orchestratorResult.title}: ${result.features.slice(0, 3).join(", ")}. Tech: ${result.techStack.join(", ")}. Files: ${result.codeFiles.length}. GitLab: ${gitlabUrl ?? "not created"}`;
  const mvpEmbedding = await generateEmbedding(mvpContent).catch(() => []);
  await saveMemory(sessionId, "mvp", mvpContent, {
    repoName: result.repoName,
    gitlabUrl,
    fileCount: result.codeFiles.length,
    techStack: result.techStack,
  }, mvpEmbedding);

  onLog?.("MVP Builder complete ✓" + (gitlabUrl ? ` — repo: ${gitlabUrl}` : ""));
  logger.info({ sessionId, gitlabUrl }, "MVP Builder Agent complete");
  return finalResult;
}

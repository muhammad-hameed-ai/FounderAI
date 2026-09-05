<div align="center">

# 🚀 FounderAI

### Your AI-Powered Startup Co-Founder

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![GitLab](https://img.shields.io/badge/GitLab-Auto_Commit-FC6D26?style=flat-square&logo=gitlab&logoColor=white)](https://gitlab.com/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)

**Drop a one-sentence startup idea → get back a full market research report, an investor-ready business plan, and working MVP code committed to GitLab — all powered by a multi-agent AI pipeline running in real-time.**

[Quick Start](#quick-start) • [Local Standalone Use](#local-standalone-use) • [Architecture](#architecture-overview) • [API Reference](#api-reference) • [Deployment](#deployment-on-render)

</div>

---

## Table of Contents

1. [What Is FounderAI?](#what-is-founderai)
2. [Key Features](#key-features)
3. [Architecture Overview](#architecture-overview)
4. [Agent Pipeline Deep Dive](#agent-pipeline-deep-dive)
5. [Real-Time SSE Streaming](#real-time-sse-streaming)
6. [Memory & Vector Search](#memory--vector-search)
7. [Tech Stack](#tech-stack)
8. [Monorepo Structure](#monorepo-structure)
9. [Data Models](#data-models)
10. [API Reference](#api-reference)
11. [Frontend Pages](#frontend-pages)
12. [Quick Start](#quick-start)
13. [Local Standalone Use](#local-standalone-use)
14. [Environment Variables](#environment-variables)
15. [MongoDB Atlas Setup](#mongodb-atlas-setup)
16. [GitLab Integration](#gitlab-integration)
17. [Deployment on Render](#deployment-on-render)
18. [Error Handling & Resilience](#error-handling--resilience)
19. [OpenAPI Contract-First Design](#openapi-contract-first-design)
20. [Contributing](#contributing)

---

## What Is FounderAI?

FounderAI is a **multi-agent AI system** that takes a raw startup idea and runs it through four sequential AI agents powered by **Google Gemini 2.5 Flash**. Each agent specialises in one domain, produces structured JSON output, embeds it as a vector, and stores it in **MongoDB Atlas** for later semantic search. The final agent generates real MVP starter code and automatically commits it to a new **GitLab repository**.

The entire process streams live log events to the browser via **Server-Sent Events (SSE)**, so you can watch each agent think in real time.

```
"A SaaS tool that helps solo founders track their MRR"
                        │
                        ▼
         ┌──────────────────────────┐
         │   FounderAI Multi-Agent  │
         │   Pipeline (Gemini 2.5)  │
         └──────────────────────────┘
                        │
        ┌───────────────┼───────────────────┐
        ▼               ▼                   ▼
  Market Report   Business Plan    MVP Code on GitLab
  (TAM, CAGR,     (Financials,     (README, package.json,
   competitors)    milestones,      server.js, auto-
                   funding ask)     committed + public)
```

---

## Key Features

| Feature | Description |
|---|---|
| 🤖 **4-Agent Pipeline** | Orchestrator → Market Research → Business Plan → MVP Builder |
| 📡 **Live SSE Streaming** | Real-time agent logs streamed to the browser, line-buffered for reliability |
| 🧠 **Vector Memory** | Every agent output embedded with Gemini Embedding (`gemini-embedding-001`, 768 dimensions) and stored in MongoDB Atlas |
| 🔍 **Semantic Search** | Ask questions across all past sessions; falls back to full-text search if vector index unavailable |
| 🦊 **GitLab Auto-Commit** | MVP Builder creates a public repo and commits generated files via GitLab API |
| ⏸ **Stop / Resume** | Stop a running session mid-pipeline; retry picks up from the last completed agent |
| 📊 **Dashboard** | Live stats: total sessions, completed analyses, memories stored, repos generated |
| 🔒 **Safe Deletes** | Sessions in `running` state return HTTP 409 and cannot be deleted |
| 🔄 **Exponential Backoff** | All Gemini calls retry up to 5× on 429/503 with 2 s → 20 s backoff |
| 📐 **Contract-First API** | OpenAPI 3.1 spec → Orval codegen → typed React Query hooks, no manual fetch code |

---

## Architecture Overview

```mermaid
graph TB
    subgraph Browser["Browser (React + Vite)"]
        UI["React UI / Wouter Router"]
        RQ["TanStack Query / Auto-typed hooks"]
        SSE["SSE Reader / Line-buffered"]
        UI --> RQ
        UI --> SSE
    end

    subgraph API["API Server (Express 5)"]
        direction TB
        ROUTES["REST Routes"]
        STREAM["SSE Endpoint POST /sessions/:id/run"]
        ZOD["Zod Validators api-zod package"]
        ROUTES --> ZOD
        STREAM --> ZOD
    end

    subgraph Agents["Agent Pipeline"]
        direction LR
        O["🧭 Orchestrator"]
        R["🔬 Market Research"]
        B["📋 Business Plan"]
        M["🛠 MVP Builder"]
        O --> R --> B --> M
    end

    subgraph Gemini["Google Gemini 2.5 Flash"]
        GEN["generateWithGemini JSON mode"]
        TEXT["generateTextWithGemini Text mode"]
        EMBED["gemini-embedding-001 768-dim vectors"]
    end

    subgraph Storage["MongoDB Atlas"]
        SESSIONS[("sessions collection")]
        MEMORIES[("memories collection")]
        VECTOR["Vector Index $vectorSearch"]
        MEMORIES --> VECTOR
    end

    subgraph GitLab["GitLab API v4"]
        REPO["Create Repo POST /projects"]
        COMMIT["Commit Files POST /repository/files"]
        REPO --> COMMIT
    end

    Browser -->|HTTP + SSE| API
    STREAM -->|runs| Agents
    Agents -->|calls| Gemini
    Gemini -->|embeddings| Storage
    Agents -->|saves results| Storage
    M -->|creates + commits| GitLab
```

---

## Agent Pipeline Deep Dive

The four agents run **sequentially** — each agent receives the previous agent's typed output as context. This prevents hallucinations and ensures every downstream decision is grounded in prior analysis.

```mermaid
sequenceDiagram
    participant FE as Frontend (SSE)
    participant API as Express API
    participant DB as MongoDB Atlas
    participant G as Gemini 2.5 Flash

    FE->>API: POST /api/sessions/:id/run
    API-->>FE: SSE started event
    API->>DB: status = "running"

    Note over API,G: Agent 1 — Orchestrator
    API->>G: generateWithGemini (JSON mode)
    G-->>API: title, summary, techStack, keyRisks, nextSteps
    API->>G: generateEmbedding
    G-->>API: float[768]
    API->>DB: memories.insertOne (type orchestrator)
    API->>DB: sessions.updateOne orchestratorResult
    API-->>FE: SSE agent orchestrator done

    Note over API,G: Agent 2 — Market Research
    API->>G: generateWithGemini + orchestrator context
    G-->>API: marketSize, competitors, keyInsights, goToMarket
    loop Per competitor and per insight
        API->>G: generateEmbedding
        API->>DB: memories.insertOne (type competitor / insight)
    end
    API->>DB: sessions.updateOne researchResult
    API-->>FE: SSE agent research done

    Note over API,G: Agent 3 — Business Plan
    API->>G: generateWithGemini + orchestrator + research context
    G-->>API: financialProjections, milestones, fundingRequirements
    API->>G: generateEmbedding
    API->>DB: memories.insertOne (type business_plan)
    API->>DB: sessions.updateOne businessPlanResult
    API-->>FE: SSE agent businessPlan done

    Note over API,G: Agent 4 — MVP Builder
    API->>G: generateTextWithGemini (plain text mode)
    G-->>API: JSON with repoName and codeFiles array
    API->>GitLab: POST /api/v4/projects (create public repo)
    loop Per code file with 400ms delay
        API->>GitLab: POST /repository/files commit
        API-->>FE: SSE log file committed
    end
    API->>G: generateEmbedding
    API->>DB: memories.insertOne (type mvp)
    API->>DB: sessions.updateOne status completed
    API-->>FE: SSE completed event
```

### Agent Output Schemas

#### 🧭 Orchestrator Agent
```typescript
interface OrchestratorResult {
  title: string;              // "MRR Tracker" — concise 2-4 word name
  summary: string;            // One-paragraph executive summary
  problemStatement: string;   // Clear problem definition
  targetMarket: string;       // Specific customer segment
  valueProposition: string;   // Unique value delivered
  revenueModel: string;       // How the startup makes money
  keyRisks: string[];
  techStack: string[];
  nextSteps: string[];
}
```

#### 🔬 Market Research Agent
```typescript
interface ResearchResult {
  marketSize: string;          // "$4.2B TAM"
  marketGrowthRate: string;    // "18% CAGR"
  marketTrends: string[];
  competitors: Competitor[];   // 3-5 real competitors with strengths/weaknesses
  competitiveAdvantage: string;
  targetCustomerInsights: string;
  keyInsights: string[];       // Each saved as a separate memory vector
  goToMarketStrategy: string;
  regulatoryConsiderations: string;
}
```

#### 📋 Business Plan Agent
```typescript
interface BusinessPlanResult {
  executiveSummary: string;
  missionStatement: string;
  pricingStrategy: string;
  financialProjections: { year: number; revenue: string; users: string; burnRate: string }[];
  fundingRequirements: string;
  useOfFunds: string[];
  milestones: { timeline: string; milestone: string }[];
  riskMitigation: { risk: string; mitigation: string }[];
}
```

#### 🛠 MVP Builder Agent
```typescript
interface MvpResult {
  repoName: string;           // "mrr-tracker-mvp"
  description: string;
  techStack: string[];
  architecture: string;
  features: string[];
  codeFiles: { filename: string; language: string; content: string; description: string }[];
  setupInstructions: string[];
  gitlabUrl: string | null;   // null if GITLAB_TOKEN not set
}
```

---

## Real-Time SSE Streaming

The `/api/sessions/:id/run` endpoint responds with `Content-Type: text/event-stream` and sends newline-delimited JSON events throughout the entire agent run.

### Event Types

```typescript
{ type: "started",   sessionId: string }
{ type: "log",       agent: string, message: string, ts: number }
{ agent: "orchestrator" | "research" | "businessPlan" | "mvpBuilder",
  status: "running" | "done" | "failed" }
{ type: "completed", sessionId: string, memoryCount: number }
{ type: "error",     message: string }
{ done: true }
```

### Frontend Line-Buffered Reader

```typescript
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split("\n");
  buffer = lines.pop()!;   // keep last incomplete line

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    try {
      const event = JSON.parse(line.slice(6));
      handleEvent(event);
    } catch { /* malformed chunk — skip */ }
  }
}
```

### Session State Machine

```mermaid
stateDiagram-v2
    [*] --> pending : Session created
    pending --> running : POST /run called
    running --> completed : All 4 agents succeed
    running --> failed : Error OR Stop clicked OR tab closed
    failed --> running : POST /run again smart resume
    completed --> [*]
    failed --> [*]
    pending --> [*] : Deleted

    note right of running
        Smart resume skips agents
        where agentProgress = done
    end note
```

### Server-Side Abort Handling

```typescript
const stoppedSessions = new Map<string, boolean>();

// Browser closes tab → abort cleanly
req.on("close", () => stoppedSessions.set(rawId, true));

// Checked between every agent
const shouldAbort = () => stoppedSessions.get(rawId) === true;
```

---

## Memory & Vector Search

Every agent saves its output as a **memory record** in MongoDB Atlas. The content is embedded with Gemini's `gemini-embedding-001` model using a 768-dimensional output, then stored alongside raw text for hybrid search.

### Memory Types

| Type | Saved By | Metadata Fields |
|---|---|---|
| `orchestrator` | Orchestrator Agent | `title`, `problemStatement` |
| `research` | Market Research Agent | `marketSize`, `competitorCount` |
| `competitor` | Market Research Agent | `competitorName`, `fundingStage` |
| `insight` | Market Research Agent | `source`, `startup` |
| `business_plan` | Business Plan Agent | `fundingRequirements`, `year1Revenue`, `missionStatement` |
| `mvp` | MVP Builder Agent | `repoName`, `gitlabUrl`, `fileCount`, `techStack` |

### Search Strategy

```mermaid
flowchart TD
    Q["User query text"] --> EMB["generateEmbedding\nGemini gemini-embedding-001"]
    EMB --> VS{"Atlas vectorSearch\navailable?"}
    VS -->|Yes| VR["Top-K by cosine similarity\n+ vectorSearchScore"]
    VS -->|No or error| FT["Fallback: full-text search\nsorted by createdAt"]
    VR --> OUT["MemoryRecord[]"]
    FT --> OUT
```

### MongoDB Atlas Vector Index

Create this index on the `memories` collection:

```json
{
  "name": "vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 768,
        "similarity": "cosine"
      }
    ]
  }
}
```

> **Important:** Add `0.0.0.0/0` to Atlas Network Access to allow connections from Render's dynamic IPs.

---

## Tech Stack

### Backend

| Layer | Technology | Why |
|---|---|---|
| Runtime | **Node.js 20+** | Native ESM, `--enable-source-maps` |
| Framework | **Express 5** | Async error propagation built-in |
| AI | **Google Gemini 2.5 Flash** | Best speed/quality for structured JSON generation |
| Embeddings | **gemini-embedding-001** (768-dim) | High-quality semantic vectors |
| Database | **MongoDB Atlas** | Native `$vectorSearch` aggregation stage |
| Validation | **Zod** (via `@workspace/api-zod`) | Schema shared between API and codegen |
| Logging | **Pino** | JSON structured logs, low overhead |
| Build | **esbuild** | Sub-second production bundles |

### Frontend

| Layer | Technology | Why |
|---|---|---|
| Framework | **React 19** | Concurrent rendering |
| Build | **Vite 6** | HMR, `BASE_URL` / `PORT` env injection |
| Routing | **Wouter** | 2 KB SPA router |
| Data fetching | **TanStack Query v5** | Auto-generated typed hooks via Orval |
| UI system | **shadcn/ui + Radix UI** | Accessible, unstyled primitives |
| Styling | **Tailwind CSS v4** | Utility-first, no runtime |
| Animation | **Framer Motion** | Agent progress transitions |

### Shared / Tooling

| Package | Purpose |
|---|---|
| `@workspace/api-spec` | Single source of truth — `openapi.yaml` |
| `@workspace/api-zod` | Zod schemas + TypeScript types from OpenAPI |
| `@workspace/api-client-react` | Orval-generated React Query hooks |
| **pnpm workspaces** | Monorepo with shared `node_modules` |
| **TypeScript 5** | Strict mode across all packages |

---

## Monorepo Structure

```
FounderAI/
├── artifacts/
│   ├── api-server/                   # Express 5 backend
│   │   └── src/
│   │       ├── index.ts              # Entry — PORT defaults to 10000 (Render)
│   │       ├── app.ts                # Express factory + middleware
│   │       ├── routes/
│   │       │   ├── sessions.ts       # CRUD + SSE /run + /stop
│   │       │   └── memory.ts         # /recall + /list
│   │       └── lib/
│   │           ├── agents/
│   │           │   ├── orchestrator.ts   # Agent 1 — idea decomposition
│   │           │   ├── research.ts       # Agent 2 — market research
│   │           │   ├── businessPlan.ts   # Agent 3 — investor plan
│   │           │   └── mvpBuilder.ts     # Agent 4 — code gen + GitLab
│   │           ├── gemini.ts         # Wrapper with exponential backoff
│   │           ├── memory.ts         # saveMemory / semanticSearch
│   │           └── mongodb.ts        # Atlas connection + collections
│   │
│   └── founder-ai/                   # React + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── dashboard.tsx     # Stats + recent activity
│           │   ├── sessions.tsx      # List + delete
│           │   ├── new-session.tsx   # Idea submission
│           │   ├── session-detail.tsx  # Live SSE + results
│           │   └── memory.tsx        # Vector search explorer
│           └── components/
│               ├── layout.tsx        # Sidebar nav + system status
│               └── ui/               # shadcn/ui components
│
├── lib/
│   ├── api-spec/openapi.yaml         # Single source of truth
│   ├── api-zod/                      # Zod validators (auto-generated)
│   └── api-client-react/             # React Query hooks (auto-generated)
│
├── render.yaml                       # Render deployment blueprint
└── pnpm-workspace.yaml
```

---

## Data Models

### Session Document

```typescript
{
  _id: ObjectId,
  title: string,           // Set by Orchestrator ("MRR Tracker")
  idea: string,            // Original user input
  status: "pending" | "running" | "completed" | "failed",
  createdAt: string,
  updatedAt: string | null,
  agentProgress: {
    orchestrator: "pending" | "running" | "done" | "failed",
    research:     "pending" | "running" | "done" | "failed",
    businessPlan: "pending" | "running" | "done" | "failed",
    mvpBuilder:   "pending" | "running" | "done" | "failed",
  },
  orchestratorResult:  OrchestratorResult | null,
  researchResult:      ResearchResult | null,
  businessPlanResult:  BusinessPlanResult | null,
  mvpResult:           MvpResult | null,
  gitlabUrl:           string | null,
  memoryCount:         number | null,
}
```

### Memory Document

```typescript
{
  _id: ObjectId,
  sessionId: string,
  type: "orchestrator" | "research" | "competitor" | "insight" | "business_plan" | "mvp",
  content: string,                    // Human-readable (used for keyword fallback)
  metadata: Record<string, unknown>,  // Agent-specific key/value pairs
  embedding: number[],                // 768-dimensional float vector
  createdAt: string,
}
```

---

## API Reference

Base path: `/api`

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Liveness check → `{ status: "ok" }` |

### Sessions

| Method | Path | Body / Params | Description |
|---|---|---|---|
| `GET` | `/sessions` | — | List all sessions, newest first |
| `POST` | `/sessions` | `{ idea: string }` | Create a session (`status: pending`) |
| `GET` | `/sessions/:id` | — | Full detail + all agent results + `memoryCount` |
| `DELETE` | `/sessions/:id` | — | Delete; returns 409 if status is `running` |
| `POST` | `/sessions/:id/run` | — | **SSE** — run all 4 agents, streams events |
| `POST` | `/sessions/:id/stop` | — | Signal agent loop to abort |
| `GET` | `/sessions/:id/status` | — | Lightweight poll — `status` + `agentProgress` |

### Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/stats` | `totalSessions`, `completedSessions`, `totalMemories`, `gitlabRepos`, `recentSessions` |

### Memory

| Method | Path | Description |
|---|---|---|
| `POST` | `/memory/recall` | Semantic vector search → `{ query, sessionId?, limit? }` |
| `GET` | `/memory/list` | Recent memories, optional `?sessionId=&type=&limit=` |

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Zod validation failed |
| `404` | Session not found |
| `409` | Conflict — agents running or delete blocked |
| `500` | Internal server error |

---

## Frontend Pages

| Page | Route | What It Does |
|---|---|---|
| **Dashboard** | `/` | Live stats, recent activity feed, MongoDB status indicator |
| **Sessions** | `/sessions` | Full list, delete button (optimistic update), running indicator |
| **New Analysis** | `/new` | Idea textarea, submit → auto-redirect + auto-start |
| **Session Detail** | `/sessions/:id` | Agent progress tracker, live log panel, Stop/Retry, all results, GitLab link |
| **Memory Explorer** | `/memory` | Semantic search with 300 ms debounce, score display, memory type badges |

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Google Gemini API key — [aistudio.google.com](https://aistudio.google.com)
- MongoDB Atlas cluster — free M0 tier works

### 1. Clone & Install

```bash
git clone https://github.com/muhammad-hameed-ai/FounderAI.git
cd FounderAI
pnpm install
```

### 2. Set Environment Variables

```bash
# Create .env in project root
GEMINI_API_KEY=your_key_here
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/founderai
GITLAB_TOKEN=glpat-xxxxxxxxxxxx
GITLAB_USERNAME=your-gitlab-username
SESSION_SECRET=any-long-random-string
```

### 3. Start Development Servers

```bash
# Terminal 1 — API (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 5173)
pnpm --filter @workspace/founder-ai run dev
```

Open `http://localhost:5173` and type your startup idea.

### 4. Type Check

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/founder-ai run typecheck
```

---

## Local Standalone Use

FounderAI does not require Replit. The repository contains the complete source,
workspace configuration, generated API client, database code, and deployment
blueprint needed to run it on a normal Node.js machine.

### One-command local development

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
cp .env.example .env
# Edit .env and add your Gemini, MongoDB, GitLab, and session values.
pnpm dev
```

The combined command starts:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8080`
- Local Vite proxy: `/api` → `http://localhost:8080`

You can also run the services separately with `pnpm dev:api` and
`pnpm dev:web`. The API loads `.env` automatically through `dotenv`; do not
commit `.env`.

### GitHub is source hosting, not full-stack hosting

GitHub can keep the project source and run CI, but GitHub Pages cannot run the
Express API, Gemini calls, MongoDB access, SSE streams, or GitLab publishing.
For the complete working application, use:

1. **GitHub** for the permanent source repository.
2. **MongoDB Atlas** for persistent data and vector search.
3. **Render or another Node.js host** for the API and static frontend.

The included `render.yaml` deploys both application services. GitHub Pages is
only suitable for a static frontend and would still need a separately hosted
API configured through `VITE_API_URL`.

---

## Environment Variables

### API Server

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GEMINI_EMBEDDING_MODEL` | Optional | Embedding model override; defaults to `gemini-embedding-001` |
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `SESSION_SECRET` | ✅ | Random secret for session signing |
| `GITLAB_TOKEN` | ⚠️ | GitLab PAT — skips repo creation if missing |
| `GITLAB_USERNAME` | ⚠️ | Paired with `GITLAB_TOKEN` |
| `PORT` | Optional | Defaults to `8080` locally; Render supplies `10000` |
| `NODE_ENV` | Optional | `development` or `production` |

### Frontend

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Production only | Full API URL e.g. `https://founderai-api.onrender.com` |

> Local dev: Vite proxies `/api` to `localhost:8080` — no `VITE_API_URL` needed.

---

## MongoDB Atlas Setup

1. Create a free **M0 cluster** at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database named `founderai`
3. **Network Access** → Add `0.0.0.0/0` to allow Render's dynamic IPs
4. Create a **database user** and copy the connection string
5. Create the **Vector Index** on the `memories` collection (Atlas Search → JSON Editor):

```json
{
  "name": "vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 768,
        "similarity": "cosine"
      }
    ]
  }
}
```

> If the vector index or embedding API is unavailable, FounderAI automatically falls back to case-insensitive keyword search — no errors shown to the user.

---

## GitLab Integration

### Setup

1. Go to [gitlab.com/-/profile/personal_access_tokens](https://gitlab.com/-/profile/personal_access_tokens)
2. Create a token with scopes: `api`, `write_repository`
3. Add `GITLAB_TOKEN` and `GITLAB_USERNAME` to your environment

### What Gets Committed

For each generated file, the MVP Builder calls:

```
POST /api/v4/projects/:id/repository/files/:filepath
{ branch: "main", content: "...", commit_message: "feat: add server.js" }
```

A **400 ms delay** between commits avoids GitLab's concurrent write rate limit. If the token is missing, the MVP structure is still returned — only `gitlabUrl` will be `null`.

---

## Deployment on Render

The project includes a `render.yaml` blueprint for one-click Render deployment.

### Services Created

```
render.yaml
├── founderai-api        → Web Service (Node.js, port 10000)
└── founderai-frontend   → Static Site (artifacts/founder-ai/dist/public)
```

### Deployment Steps

1. Push repo to GitHub
2. Render Dashboard → **New** → **Blueprint** → connect your repo
3. **Deploy `founderai-api` first** — wait for "Live" status
4. Copy the API URL (e.g. `https://founderai-api.onrender.com`)
5. Set these secrets on `founderai-api` in the Render dashboard:

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | Your Gemini key |
| `MONGODB_URI` | Atlas connection string |
| `SESSION_SECRET` | Any long random string |
| `GITLAB_TOKEN` | Your GitLab PAT |
| `GITLAB_USERNAME` | Your GitLab username |
| `NODE_ENV` | `production` |

6. Set `VITE_API_URL` on `founderai-frontend` → the API URL from step 4
7. Deploy the frontend

Render pings `GET /api/healthz` every 30 s as a liveness check.

---

## Error Handling & Resilience

### Gemini Retry with Exponential Backoff

```mermaid
flowchart TD
    CALL["Gemini API call"] --> ERR{"Error?"}
    ERR -->|No| SUCCESS["Return result"]
    ERR -->|Yes| RETRY{"Retryable?\n429 / 503 / UNAVAILABLE\nquota / overloaded"}
    RETRY -->|No| THROW["Throw — fail the agent"]
    RETRY -->|"Yes, attempt < 5"| DELAY["Wait 2^attempt × 2s (max 20s)"]
    DELAY --> CALL
    RETRY -->|"attempt >= 5"| THROW
```

| Attempt | Wait |
|---|---|
| 1st retry | 2 s |
| 2nd retry | 4 s |
| 3rd retry | 8 s |
| 4th retry | 16 s |
| 5th retry | Error thrown |

### MVP Builder JSON Fallback

If Gemini returns malformed JSON, `safeParseJson()` strips markdown fences and extracts the outermost `{...}` block. If that also fails, a **deterministic fallback skeleton** is used (README + package.json + Express server), so the GitLab commit always succeeds.

### Stop / Abort Safety

The `stoppedSessions` Map is the shared abort channel between `POST /stop`, `req.on('close')` (tab closed), and the agent loop. The loop calls `shouldAbort()` before every agent — no orphaned Gemini calls after disconnect.

---

## OpenAPI Contract-First Design

```mermaid
flowchart LR
    SPEC["lib/api-spec/openapi.yaml"] -->|Orval codegen| ZOD["lib/api-zod\nZod schemas + TS types"]
    SPEC -->|Orval codegen| RQ["lib/api-client-react\nReact Query hooks"]
    ZOD -->|req/res validation| API["api-server"]
    RQ -->|typed data fetching| FE["founder-ai frontend"]
```

**Adding a new endpoint:**
1. Define path + schema in `openapi.yaml`
2. Run `pnpm run codegen` in `lib/api-zod` and `lib/api-client-react`
3. Implement the Express route using the generated Zod schema
4. The frontend hook is immediately available with full TypeScript types

---

## Contributing

```bash
# Fork → clone → branch
git checkout -b feat/your-feature

# Make changes, verify types
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/founder-ai run typecheck

# Commit with conventional commits
git commit -m "feat: add agent X"
git push origin feat/your-feature
# Open a Pull Request
```

### Project Conventions

| Convention | Detail |
|---|---|
| **Agents** | Must accept `onLog?: (msg: string) => void` and call it at key steps |
| **Memory** | Every new agent type saves at least one embedding to `memories` |
| **Validation** | New routes use Zod schema from `@workspace/api-zod`, never ad-hoc validation |
| **Errors** | Throw descriptive `Error("Agent X: reason")` — never swallow silently |
| **Retries** | New Gemini calls go through `generateWithGemini` or `generateTextWithGemini` |

---

<div align="center">

Built with Google Gemini 2.5 Flash · MongoDB Atlas · React · Express

**[⭐ Star on GitHub](https://github.com/muhammad-hameed-ai/FounderAI)**

</div>

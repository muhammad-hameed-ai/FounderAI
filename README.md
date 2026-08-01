<![CDATA[<div align="center">

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

[Live Demo](#deployment) • [Quick Start](#quick-start) • [Architecture](#architecture) • [API Reference](#api-reference) • [Deployment](#deployment)

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
12. [Quick Start (Local Dev)](#quick-start)
13. [Environment Variables](#environment-variables)
14. [MongoDB Atlas Setup](#mongodb-atlas-setup)
15. [GitLab Integration](#gitlab-integration)
16. [Deployment on Render](#deployment-on-render)
17. [Error Handling & Resilience](#error-handling--resilience)
18. [OpenAPI Contract-First Design](#openapi-contract-first-design)
19. [Contributing](#contributing)

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
| 🧠 **Vector Memory** | Every agent output embedded with `text-embedding-004` and stored in MongoDB Atlas |
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
        UI[React UI<br/>Wouter Router]
        RQ[TanStack Query<br/>Auto-typed hooks]
        SSE[SSE Reader<br/>Line-buffered]
        UI --> RQ
        UI --> SSE
    end

    subgraph API["API Server (Express 5)"]
        direction TB
        ROUTES[REST Routes<br/>/api/sessions<br/>/api/memory<br/>/api/dashboard]
        STREAM[SSE Endpoint<br/>POST /sessions/:id/run]
        ZOD[Zod Validators<br/>api-zod package]
        ROUTES --> ZOD
        STREAM --> ZOD
    end

    subgraph Agents["Agent Pipeline"]
        direction LR
        O[🧭 Orchestrator<br/>Idea analysis]
        R[🔬 Research<br/>Market data]
        B[📋 Business Plan<br/>Investor deck]
        M[🛠 MVP Builder<br/>Code gen]
        O --> R --> B --> M
    end

    subgraph Gemini["Google Gemini 2.5 Flash"]
        GEN[generateWithGemini<br/>JSON mode]
        TEXT[generateTextWithGemini<br/>Text mode]
        EMBED[generateEmbedding<br/>text-embedding-004<br/>768-dim vectors]
    end

    subgraph Storage["MongoDB Atlas"]
        SESSIONS[(sessions<br/>collection)]
        MEMORIES[(memories<br/>collection)]
        VECTOR[Vector Index<br/>$vectorSearch<br/>768 dimensions]
        MEMORIES --> VECTOR
    end

    subgraph GitLab["GitLab API v4"]
        REPO[Create Repo<br/>POST /projects]
        COMMIT[Commit Files<br/>POST /repository/files/:path]
        REPO --> COMMIT
    end

    Browser -->|HTTP + SSE| API
    STREAM -->|runs| Agents
    Agents -->|calls| Gemini
    Gemini -->|embeddings| Storage
    Agents -->|saves results| Storage
    M -->|creates + commits| GitLab

    style Browser fill:#1e293b,stroke:#334155,color:#e2e8f0
    style API fill:#1e293b,stroke:#334155,color:#e2e8f0
    style Agents fill:#1e293b,stroke:#334155,color:#e2e8f0
    style Gemini fill:#1a237e,stroke:#3949ab,color:#e8eaf6
    style Storage fill:#1b5e20,stroke:#388e3c,color:#e8f5e9
    style GitLab fill:#3e1f02,stroke:#e24329,color:#fbe9e7
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
    API-->>FE: SSE: { type: "started" }
    API->>DB: status = "running"

    Note over API,G: ── Agent 1: Orchestrator ──
    API-->>FE: SSE log: "Analyzing startup idea..."
    API->>G: generateWithGemini(prompt, JSON mode)
    G-->>API: { title, summary, problemStatement,<br/>targetMarket, valueProposition,<br/>revenueModel, keyRisks[], techStack[], nextSteps[] }
    API->>G: generateEmbedding(content)
    G-->>API: float[768]
    API->>DB: memories.insertOne({ type:"orchestrator", embedding })
    API->>DB: sessions.updateOne({ orchestratorResult, agentProgress.orchestrator:"done" })
    API-->>FE: SSE: { agent:"orchestrator", status:"done" }

    Note over API,G: ── Agent 2: Market Research ──
    API-->>FE: SSE log: "Starting market research..."
    API->>G: generateWithGemini(prompt + orchestratorResult context)
    G-->>API: { marketSize, marketGrowthRate, competitors[],<br/>competitiveAdvantage, keyInsights[],<br/>goToMarketStrategy, regulatoryConsiderations }
    loop Per competitor + per insight
        API->>G: generateEmbedding(competitorContent)
        API->>DB: memories.insertOne({ type:"competitor"|"insight" })
    end
    API->>DB: sessions.updateOne({ researchResult, agentProgress.research:"done" })
    API-->>FE: SSE: { agent:"research", status:"done" }

    Note over API,G: ── Agent 3: Business Plan ──
    API-->>FE: SSE log: "Building investor-ready business plan..."
    API->>G: generateWithGemini(prompt + orchestrator + research context)
    G-->>API: { executiveSummary, pricingStrategy,<br/>financialProjections[3yr], milestones[],<br/>fundingRequirements, riskMitigation[] }
    API->>G: generateEmbedding(planContent)
    API->>DB: memories.insertOne({ type:"business_plan" })
    API->>DB: sessions.updateOne({ businessPlanResult, agentProgress.businessPlan:"done" })
    API-->>FE: SSE: { agent:"businessPlan", status:"done" }

    Note over API,G: ── Agent 4: MVP Builder ──
    API-->>FE: SSE log: "Generating MVP code..."
    API->>G: generateTextWithGemini(prompt, plain-text mode)
    G-->>API: JSON string with { repoName, codeFiles[], features[] }
    Note over API: safeParseJson() → fallback skeleton if parse fails
    API->>+GitLab: POST /api/v4/projects (create public repo)
    GitLab-->>API: { id, web_url, default_branch }
    loop Per code file (400ms delay between commits)
        API->>GitLab: POST /repository/files/:path (commit)
        API-->>FE: SSE log: "✓ server.js committed"
    end
    API->>G: generateEmbedding(mvpContent)
    API->>DB: memories.insertOne({ type:"mvp", gitlabUrl })
    API->>DB: sessions.updateOne({ status:"completed", mvpResult, gitlabUrl })
    API-->>FE: SSE: { type:"completed", memoryCount }
    API-->>FE: SSE: { done: true }
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
  keyRisks: string[];         // ["Competition from Stripe...", ...]
  techStack: string[];        // ["React", "Node.js", "Stripe API"]
  nextSteps: string[];        // Prioritised action items
}
```

#### 🔬 Market Research Agent
```typescript
interface ResearchResult {
  marketSize: string;              // "$4.2B TAM"
  marketGrowthRate: string;        // "18% CAGR"
  marketTrends: string[];
  competitors: Competitor[];       // 3-5 real competitors
  competitiveAdvantage: string;
  targetCustomerInsights: string;
  keyInsights: string[];           // Each saved as separate memory vector
  goToMarketStrategy: string;
  regulatoryConsiderations: string;
}

interface Competitor {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  fundingStage: string;   // "Seed" | "Series A" | "Public" | ...
}
```

#### 📋 Business Plan Agent
```typescript
interface BusinessPlanResult {
  executiveSummary: string;
  missionStatement: string;
  productDescription: string;
  businessModel: string;
  pricingStrategy: string;
  salesStrategy: string;
  marketingStrategy: string;
  operationalPlan: string;
  teamRequirements: string[];
  financialProjections: FinancialProjection[];   // 3-year forecast
  fundingRequirements: string;
  useOfFunds: string[];
  milestones: { timeline: string; milestone: string }[];
  riskMitigation: { risk: string; mitigation: string }[];
}

interface FinancialProjection {
  year: number;       // 1 | 2 | 3
  revenue: string;    // "$240K"
  users: string;      // "1,200"
  burnRate: string;   // "$18K/month"
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
  codeFiles: CodeFile[];      // README.md, package.json, server.js, ...
  setupInstructions: string[];
  gitlabUrl: string | null;   // null if GITLAB_TOKEN not set
}

interface CodeFile {
  filename: string;    // "server.js"
  language: string;   // "javascript"
  content: string;
  description: string;
}
```

---

## Real-Time SSE Streaming

The `/api/sessions/:id/run` endpoint responds with `Content-Type: text/event-stream` and sends newline-delimited JSON events throughout the entire agent run.

### Event Types

```typescript
// Session started
{ type: "started", sessionId: string }

// Agent status change (used to update progress indicators)
{ agent: "orchestrator"|"research"|"businessPlan"|"mvpBuilder",
  status: "running"|"done"|"failed",
  ...agentResult? }

// Live log line from inside an agent (shown in the log panel)
{ type: "log", agent: string, message: string, ts: number }

// All agents finished successfully
{ type: "completed", sessionId: string, memoryCount: number }

// Unrecoverable error
{ type: "error", message: string }

// Stream is closing (always sent last)
{ done: true }
```

### Frontend SSE Reader (Line-Buffered)

Raw SSE chunks are not guaranteed to be one event per `read()` call. The frontend buffers partial lines to avoid JSON parse errors:

```typescript
// artifacts/founder-ai/src/pages/session-detail.tsx

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  // Process all complete lines in the buffer
  const lines = buffer.split("\n");
  buffer = lines.pop()!;   // Keep the last (potentially incomplete) line

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    try {
      const event = JSON.parse(line.slice(6));
      handleEvent(event);
    } catch { /* malformed chunk — skip */ }
  }
}
```

### Server-Side Abort Handling

```typescript
// artifacts/api-server/src/routes/sessions.ts

const stoppedSessions = new Map<string, boolean>();

// Browser closes tab → mark session aborted
req.on("close", () => {
  stoppedSessions.set(rawId, true);
});

// Checked between every agent
const shouldAbort = () => stoppedSessions.get(rawId) === true;
```

```mermaid
stateDiagram-v2
    [*] --> pending : Session created
    pending --> running : POST /run called
    running --> completed : All 4 agents succeed
    running --> failed : Error thrown OR Stop clicked OR tab closed
    failed --> running : POST /run again (smart resume)
    completed --> [*]
    failed --> [*]
    pending --> [*] : Deleted

    note right of running
        Smart resume skips agents
        where agentProgress = "done"
    end note
```

---

## Memory & Vector Search

Every agent saves its output as a **memory record** in MongoDB Atlas. The content is first embedded with Gemini's `text-embedding-004` model (768-dimensional vectors), then stored alongside the raw text for hybrid search.

### Memory Types

| Type | Saved By | Metadata Fields |
|---|---|---|
| `orchestrator` | Orchestrator | `title`, `problemStatement` |
| `research` | Market Research | `marketSize`, `competitorCount` |
| `competitor` | Market Research | `competitorName`, `fundingStage` |
| `insight` | Market Research | `source`, `startup` |
| `business_plan` | Business Plan | `fundingRequirements`, `year1Revenue`, `missionStatement` |
| `mvp` | MVP Builder | `repoName`, `gitlabUrl`, `fileCount`, `techStack` |

### Search Strategy

```mermaid
flowchart TD
    Q[User query text] --> EMB[generateEmbedding\nGemini text-embedding-004]
    EMB --> VS{Atlas $vectorSearch\nvector_index available?}
    VS -->|Yes| VR[Top-K results\nby cosine similarity\n+ vectorSearchScore]
    VS -->|No / error| FT[Fallback: $text search\n+ sort by createdAt]
    VR --> OUT[MemoryRecord[]]
    FT --> OUT
```

```typescript
// Semantic recall — called from POST /api/memory/recall
const results = await semanticSearch(
  queryEmbedding,   // float[768]
  limit,            // default 10
  sessionId,        // optional — scope to one session
  fallbackQuery     // original text for $text fallback
);
```

### MongoDB Atlas Vector Index Config

Create this index on the `memories` collection in Atlas:

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

> **Note:** Atlas requires IP whitelisting. Add `0.0.0.0/0` to allow connections from Render's dynamic IPs, or set your specific egress range.

---

## Tech Stack

### Backend

| Layer | Technology | Why |
|---|---|---|
| Runtime | **Node.js 20+** | Native ESM, `--enable-source-maps` |
| Framework | **Express 5** | Async error propagation built-in |
| AI | **Google Gemini 2.5 Flash** (`@google/genai`) | Best speed/quality for structured JSON generation |
| Embeddings | **text-embedding-004** (768-dim) | High-quality semantic vectors at low cost |
| Database | **MongoDB Atlas** | Native `$vectorSearch` aggregation stage |
| Validation | **Zod** (via `@workspace/api-zod`) | Schema shared between API and codegen |
| Logging | **Pino** | JSON structured logs, low overhead |
| Build | **esbuild** (`build.mjs`) | Sub-second production bundles |

### Frontend

| Layer | Technology | Why |
|---|---|---|
| Framework | **React 19** | Concurrent rendering, Suspense |
| Build | **Vite 6** | HMR, `BASE_URL` / `PORT` injection |
| Routing | **Wouter** | 2 KB SPA router, no boilerplate |
| Data fetching | **TanStack Query v5** | Auto-generated typed hooks via Orval |
| UI system | **shadcn/ui** + **Radix UI** | Accessible, unstyled primitives |
| Styling | **Tailwind CSS v4** | Utility-first, no runtime |
| Animation | **Framer Motion** | Agent progress transitions |
| Date formatting | **date-fns** | `formatDistanceToNow` for activity feed |

### Shared / Tooling

| Package | Purpose |
|---|---|
| `@workspace/api-spec` | Single source of truth — `openapi.yaml` |
| `@workspace/api-zod` | Zod schemas + TypeScript types generated from OpenAPI |
| `@workspace/api-client-react` | Orval-generated React Query hooks (never write `fetch` manually) |
| **pnpm workspaces** | Monorepo with shared `node_modules` hoisting |
| **TypeScript 5** | Strict mode across all packages |

---

## Monorepo Structure

```
FounderAI/
├── artifacts/
│   ├── api-server/                 # Express 5 backend
│   │   ├── src/
│   │   │   ├── index.ts            # Entry point — PORT defaults to 10000 (Render)
│   │   │   ├── app.ts              # Express app factory + middleware
│   │   │   ├── routes/
│   │   │   │   ├── sessions.ts     # Core session CRUD + SSE /run + /stop
│   │   │   │   └── memory.ts       # /recall + /list endpoints
│   │   │   └── lib/
│   │   │       ├── agents/
│   │   │       │   ├── orchestrator.ts   # Agent 1 — idea decomposition
│   │   │       │   ├── research.ts       # Agent 2 — market research
│   │   │       │   ├── businessPlan.ts   # Agent 3 — investor plan
│   │   │       │   └── mvpBuilder.ts     # Agent 4 — code gen + GitLab
│   │   │       ├── gemini.ts       # Gemini wrapper with retry logic
│   │   │       ├── memory.ts       # saveMemory / semanticSearch / listMemories
│   │   │       ├── mongodb.ts      # Atlas connection + collection getters
│   │   │       └── logger.ts       # Pino logger instance
│   │   ├── build.mjs               # esbuild bundler script
│   │   └── package.json
│   │
│   └── founder-ai/                 # React + Vite frontend
│       ├── src/
│       │   ├── main.tsx            # Entry — sets API base URL from VITE_API_URL
│       │   ├── App.tsx             # Wouter router
│       │   ├── pages/
│       │   │   ├── dashboard.tsx   # Stats + recent activity
│       │   │   ├── sessions.tsx    # Sessions list + delete
│       │   │   ├── new-session.tsx # Idea submission form
│       │   │   ├── session-detail.tsx  # Live SSE + full agent results
│       │   │   └── memory.tsx      # Vector search explorer
│       │   └── components/
│       │       ├── layout.tsx      # Sidebar nav + system status
│       │       ├── status-badge.tsx
│       │       └── ui/             # shadcn/ui components
│       ├── vite.config.ts          # PORT + BASE_PATH from env (Replit-compatible)
│       └── package.json
│
├── lib/
│   ├── api-spec/
│   │   └── openapi.yaml            # OpenAPI 3.1 — single source of truth
│   ├── api-zod/                    # Zod validators auto-generated by Orval
│   │   └── src/generated/
│   └── api-client-react/           # React Query hooks auto-generated by Orval
│       └── src/generated/
│
├── render.yaml                     # Render blueprint (API + static site)
├── pnpm-workspace.yaml
└── package.json
```

---

## Data Models

### Session Document (MongoDB)

```typescript
{
  _id: ObjectId,
  title: string,                    // Set by Orchestrator ("MRR Tracker")
  idea: string,                     // Original user input
  status: "pending" | "running" | "completed" | "failed",
  createdAt: string,                // ISO-8601
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

### Memory Document (MongoDB)

```typescript
{
  _id: ObjectId,
  sessionId: string,           // References sessions._id (as string)
  type: "orchestrator" | "research" | "competitor" |
        "insight" | "business_plan" | "mvp",
  content: string,             // Human-readable text (used for $text fallback)
  metadata: Record<string, unknown>,  // Agent-specific key/value pairs
  embedding: number[],         // 768-dimensional float vector
  createdAt: string,           // ISO-8601
}
```

---

## API Reference

Base path: `/api`

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Liveness check — returns `{ status: "ok" }` |

### Sessions

| Method | Path | Body / Params | Description |
|---|---|---|---|
| `GET` | `/sessions` | — | List all sessions (most recent first, limit 100) |
| `POST` | `/sessions` | `{ idea: string }` | Create a new session (status: `pending`) |
| `GET` | `/sessions/:id` | — | Full session detail including all agent results and `memoryCount` |
| `DELETE` | `/sessions/:id` | — | Delete session; returns 409 if status is `running` |
| `POST` | `/sessions/:id/run` | — | **SSE** — run all agents; streams events until complete |
| `POST` | `/sessions/:id/stop` | — | Signal the running agent loop to abort |
| `GET` | `/sessions/:id/status` | — | Lightweight status poll (`status` + `agentProgress`) |

### Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/stats` | `{ totalSessions, completedSessions, totalMemories, gitlabRepos, recentSessions[] }` |

### Memory

| Method | Path | Body / Query | Description |
|---|---|---|---|
| `POST` | `/memory/recall` | `{ query, sessionId?, limit? }` | Semantic vector search; returns memories with `score` |
| `GET` | `/memory/list` | `?sessionId=&type=&limit=` | List recent memories with optional filters |

### Status Codes

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created (new session) |
| `400` | Bad request — Zod validation failed |
| `404` | Session not found |
| `409` | Conflict — agents already running OR session is `running` on delete |
| `500` | Internal server error |

---

## Frontend Pages

### Dashboard (`/`)
- Live stats: Total Sessions, Analyses Completed, Insights Memorized, Repos Generated
- Recent Activity feed with status badges
- System status indicator (MongoDB connection)
- Auto-refreshes every 30 s via TanStack Query `refetchInterval`

### Sessions (`/sessions`)
- Full session list with status badges and timestamps
- **Delete (×)** button with optimistic update (instant UI removal before API confirms)
- Running sessions show a pulsing indicator; delete is blocked
- Clicking a row navigates to the session detail page

### New Analysis (`/new`)
- Single textarea for the startup idea
- Submit triggers `POST /api/sessions` → then redirects to the detail page and starts `/run` automatically
- Loader spinner during pending state

### Session Detail (`/sessions/:id`)
- Agent progress tracker (4 steps, colour-coded: pending / running / done / failed)
- **Live log panel** — real-time SSE log messages per agent
- **Stop** button cancels the SSE reader and calls `POST /sessions/:id/stop`
- **Retry** button (on failed sessions) restarts the run with smart resume
- Four expandable result sections: Idea Analysis, Market Research, Business Plan, MVP
- GitLab repo link when available

### Memory Explorer (`/memory`)
- Semantic search bar with 300 ms debounce
- Shows matching memories with `score` (cosine similarity) for vector hits
- Recent memories grid when no search active
- Memory type badges: orchestrator / research / competitor / insight / business_plan / mvp

---

## Quick Start

### Prerequisites

- **Node.js 20+**
- **pnpm 9+** (`npm install -g pnpm`)
- A **Google Gemini API key** (free tier available at [aistudio.google.com](https://aistudio.google.com))
- A **MongoDB Atlas** cluster (free M0 tier works)

### 1. Clone & Install

```bash
git clone https://github.com/muhammad-hameed-ai/FounderAI.git
cd FounderAI
pnpm install
```

### 2. Set Environment Variables

Copy the example and fill in the values:

```bash
cp .env.example .env
# Edit .env with your keys (see Environment Variables section)
```

### 3. Start Development Servers

Open **two terminals**:

```bash
# Terminal 1 — API server (port 8080 by default)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — React frontend (port 5173 by default)
pnpm --filter @workspace/founder-ai run dev
```

Open `http://localhost:5173` and start building your startup.

### 4. (Optional) Run Type Checks

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/founder-ai run typecheck
```

---

## Environment Variables

### API Server

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `GITLAB_TOKEN` | ⚠️ | GitLab personal access token (MVP Builder skips repo creation if missing) |
| `GITLAB_USERNAME` | ⚠️ | Your GitLab username (used with `GITLAB_TOKEN`) |
| `SESSION_SECRET` | ✅ | Random secret for session signing (any long random string) |
| `GITHUB_TOKEN` | Optional | Only needed if you push via shell scripts |
| `PORT` | Optional | Defaults to `10000` (Render standard); override for local dev |
| `NODE_ENV` | Optional | `"development"` or `"production"` |

### Frontend

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Production only | Full URL of the deployed API, e.g. `https://founderai-api.onrender.com` |

> **Local dev:** The frontend proxies `/api` to `localhost:8080` via the Vite config — no `VITE_API_URL` needed.

---

## MongoDB Atlas Setup

1. **Create a free M0 cluster** at [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Create a database** named `founderai`
3. **Whitelist IPs**: Go to *Network Access* → *Add IP Address* → add `0.0.0.0/0` (allow all)
4. **Create a database user** with read/write access — copy the password into your connection string
5. **Create the Vector Index** on the `memories` collection:
   - Go to *Atlas Search* → *Create Search Index* → *JSON Editor*
   - Choose type **Vector Search** and paste:

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

> If the vector index is unavailable (e.g. M0 doesn't support it in your region), FounderAI automatically falls back to MongoDB `$text` search — you won't see an error.

---

## GitLab Integration

The MVP Builder creates a **public GitLab repository** and commits all generated files automatically.

### Setup

1. Go to [gitlab.com/-/profile/personal_access_tokens](https://gitlab.com/-/profile/personal_access_tokens)
2. Create a token with scopes: `api`, `write_repository`
3. Add to environment:
   ```
   GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
   GITLAB_USERNAME=your-gitlab-username
   ```

### What Gets Committed

For each generated `codeFiles` entry, the agent makes a separate API call:

```
POST /api/v4/projects/:id/repository/files/:filepath
{
  branch: "main",
  content: "<file content>",
  commit_message: "feat: add server.js"
}
```

A 400 ms delay between commits avoids GitLab's concurrent write rate limit.

If `GITLAB_TOKEN` is not set, the agent skips repo creation and still returns the MVP structure — only `gitlabUrl` will be `null`.

---

## Deployment on Render

FounderAI ships with a `render.yaml` blueprint for one-click deployment on [Render](https://render.com) (free tier available).

### Architecture on Render

```
render.yaml
├── founderai-api        (Web Service — Node.js, port 10000)
└── founderai-frontend   (Static Site — artifacts/founder-ai/dist/public)
```

### Step-by-Step

1. **Fork or push** this repo to your GitHub account
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect your GitHub repo — Render detects `render.yaml` automatically
4. **Deploy `founderai-api` first** — wait for it to go live
5. Copy the API URL (e.g. `https://founderai-api.onrender.com`)
6. **Set environment secrets** in the Render dashboard for `founderai-api`:

   | Key | Value |
   |---|---|
   | `GEMINI_API_KEY` | Your Gemini API key |
   | `MONGODB_URI` | Your Atlas connection string |
   | `GITLAB_TOKEN` | Your GitLab PAT |
   | `GITLAB_USERNAME` | Your GitLab username |
   | `SESSION_SECRET` | Any long random string |

7. **Set `VITE_API_URL`** on `founderai-frontend` to the API URL from step 5
8. Deploy the frontend — Render builds and publishes to a global CDN

### Build Commands (what Render runs)

```bash
# API
npm install -g pnpm && pnpm install && pnpm --filter @workspace/api-server run build
node artifacts/api-server/dist/index.mjs

# Frontend
npm install -g pnpm && pnpm install && pnpm --filter @workspace/founder-ai run build
# Static files served from: artifacts/founder-ai/dist/public
```

### Health Check

Render pings `GET /api/healthz` every 30 s to verify the API is alive.

---

## Error Handling & Resilience

```mermaid
flowchart TD
    CALL[Gemini API call] --> ERR{Error?}
    ERR -->|No| SUCCESS[Return result]
    ERR -->|Yes| RETRY{Is retryable?\n429 / 503 / UNAVAILABLE\n/ quota / overloaded}
    RETRY -->|No| THROW[Throw — propagate to agent]
    RETRY -->|Yes, attempt < 5| DELAY["Wait: 2^attempt × 2s\n(max 20s)"]
    DELAY --> CALL
    RETRY -->|Yes, attempt ≥ 5| THROW
```

### Retry Policy

| Attempt | Delay |
|---|---|
| 1 | 2 s |
| 2 | 4 s |
| 3 | 8 s |
| 4 | 16 s |
| 5 (max) | Error thrown |

### MVP Builder Fallback

If Gemini returns malformed JSON for the MVP structure (code generation is less deterministic than analysis), `safeParseJson()` attempts to extract the outermost `{ ... }` block and parse it. If that also fails, a deterministic **fallback skeleton** is returned:

```
fallback: README.md + package.json + server.js
         (Express health-check app with the startup name)
```

This means the GitLab commit always succeeds, even if Gemini's JSON is unusable.

### Stop / Abort Safety

The `stoppedSessions` in-memory Map is the shared abort channel between the HTTP `/stop` endpoint and the SSE agent loop. The loop checks `shouldAbort()` at every agent boundary. On tab close, `req.on('close')` sets the flag, so no orphaned Gemini calls accumulate after the user navigates away.

---

## OpenAPI Contract-First Design

The entire API surface is defined in **one file**: `lib/api-spec/openapi.yaml`. Two packages are auto-generated from it:

```mermaid
flowchart LR
    SPEC[lib/api-spec/openapi.yaml\nOpenAPI 3.1] -->|Orval codegen| ZOD[lib/api-zod\nZod schemas\n+ TypeScript types]
    SPEC -->|Orval codegen| RQ[lib/api-client-react\nReact Query hooks\n+ typed fetch clients]
    ZOD -->|imported by| API[api-server\nreq/res validation]
    RQ -->|imported by| FE[founder-ai\nno manual fetch code]
```

**Adding a new endpoint:**

1. Define the path + schema in `openapi.yaml`
2. Run `pnpm run codegen` (in `lib/api-zod` and `lib/api-client-react`)
3. Implement the Express route using the generated Zod schema for validation
4. The frontend hook is immediately available with full TypeScript types

This eliminates drift between backend contract and frontend consumption — if the API shape changes, the frontend won't compile until it's updated to match.

---

## Contributing

```bash
# Fork → clone → branch
git checkout -b feat/your-feature

# Make changes, then:
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
| **Agents** | Each agent must accept `onLog?: (msg: string) => void` and call it at key steps |
| **Memory** | Every new agent type should save at least one embedding to `memories` |
| **Validation** | New routes must use the Zod schema from `@workspace/api-zod`, never ad-hoc validation |
| **Errors** | Throw descriptive `Error("Agent X: reason")` — never swallow errors silently |
| **Retries** | Any new Gemini call should go through `generateWithGemini` or `generateTextWithGemini`, not `ai.models` directly |

---

<div align="center">

Built with ❤️ using Google Gemini 2.5 Flash · MongoDB Atlas · React · Express

**[⭐ Star on GitHub](https://github.com/muhammad-hameed-ai/FounderAI)**

</div>
]]>
# FounderAI

A Gemini-powered startup co-founder agent that uses MongoDB Atlas as its long-term memory and knowledge store. Describe a startup idea once and the agent researches it, generates a business plan, commits MVP code to GitLab, and stores every decision in MongoDB with vector search for semantic recall.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/founder-ai run dev` — run the React frontend (port 25927)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + MongoDB Atlas
- AI: Google Gemini 2.5 Flash (generateContent + embedContent)
- DB: MongoDB Atlas (sessions + memories collections)
- Validation: Zod (`zod/v4`), Orval codegen
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — React Query hooks (generated)
- `lib/api-zod/src/generated/` — Zod schemas (generated)
- `artifacts/api-server/src/lib/agents/` — 4 AI agents (orchestrator, research, businessPlan, mvpBuilder)
- `artifacts/api-server/src/lib/mongodb.ts` — MongoDB Atlas client
- `artifacts/api-server/src/lib/gemini.ts` — Gemini AI client
- `artifacts/api-server/src/lib/memory.ts` — Memory save/recall (vector + text fallback)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/founder-ai/src/` — React frontend

## Architecture decisions

- MongoDB Atlas stores all sessions and memories; no Postgres/Drizzle used (MongoDB is the primary DB)
- Vector search uses MongoDB Atlas $vectorSearch aggregation pipeline with text-embedding-004 embeddings; falls back to text search if index not set up
- Each agent (Orchestrator, Research, BusinessPlan, MVP Builder) runs sequentially and saves memories to MongoDB after completion
- GitLab repo creation and file commits happen via GitLab REST API v4 in the MVP Builder agent
- SSE (Server-Sent Events) streams agent progress to the frontend during the run

## Product

- **Dashboard** — overview stats (sessions, memories, GitLab repos) + recent sessions
- **New Analysis** — submit a startup idea to trigger all 4 agents
- **Session Detail** — real-time agent progress via SSE, full results for each agent, GitLab repo link, memory tab
- **Sessions List** — all past analyses with status and progress
- **Memory Explorer** — semantic vector search over all stored insights and findings

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **MongoDB Atlas IP Whitelist**: Must add `0.0.0.0/0` (Allow Access from Anywhere) in Atlas → Network Access, or the server gets a TLS SSL error and cannot connect
- **Vector Search Index**: Must create a vector search index named `vector_index` on the `memories` collection with path `embedding` (768 dims for text-embedding-004) in Atlas before semantic recall works. Falls back to text search if the index doesn't exist.
- **Gemini embeddings**: Uses `text-embedding-004` model via the `ai.models.embedContent()` API. This is separate from content generation.
- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before using updated types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

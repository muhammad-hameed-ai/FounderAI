<div align="center">

# 🚀 FounderAI
### The Master-Level Autonomous Startup Architect

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Gemini](https://img.shields.io/badge/Gemini-3.6_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![GitLab](https://img.shields.io/badge/GitLab-Auto_Commit-FC6D26?style=for-the-badge&logo=gitlab&logoColor=white)](https://gitlab.com/)

**Drop a single-sentence startup idea → Receive a comprehensive market research report, an investor-ready business plan, and a fully scaffolded MVP codebase committed directly to GitLab.**

*Powered by a dynamic, multi-agent AI pipeline running in real-time.*

[Quick Start](#quick-start) • [Architecture](#architecture-overview) • [Agent Pipeline](#agent-pipeline-deep-dive) • [Deployment](#deployment-on-render)

</div>

---

## 🌟 What Is FounderAI?

FounderAI is a **master-level, multi-agent artificial intelligence system**. It takes a raw, unstructured startup idea and processes it through an advanced sequential assembly line of four specialized AI agents powered by **Google Gemini 3.6 Flash**. 

Each agent specializes in a distinct domain, producing structured JSON outputs, generating vector embeddings, and securely storing knowledge in **MongoDB Atlas** for high-speed semantic retrieval. The final developer agent autonomously architects a Minimum Viable Product (MVP) codebase and physically pushes it to a live **GitLab repository**.

The entire orchestration streams live to a dark-mode React frontend via **Server-Sent Events (SSE)**, creating a highly dynamic, motion-rich user experience.

```text
"A platform that turns learning to code into an RPG-style game"
                              │
                              ▼
               ┌──────────────────────────────┐
               │    FounderAI Multi-Agent     │
               │   Pipeline (Gemini 3.6)      │
               └──────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────────┐
          ▼                   ▼                       ▼
    Market Report       Business Plan         MVP Code on GitLab
   (TAM, CAGR, GTM)   (Financials, Team)   (Auto-committed boilerplate)
```

---

## ⚡ Key Features

| Feature | Description |
|---|---|
| 🤖 **Autonomous 4-Agent Pipeline** | Orchestrator → Market Research → Business Plan → MVP Builder |
| 📡 **Dynamic Live Streaming** | Real-time agent thought-processes streamed to the browser via SSE |
| 🧠 **Persistent Vector Memory** | Semantic data storage using `gemini-embedding-001` (768 dimensions) in MongoDB Atlas |
| 🔍 **RAG Semantic Search** | Intelligent retrieval across all past startup sessions and market insights |
| 🦊 **GitLab Auto-Deploy** | Autonomous repository creation and code commits via the GitLab v4 API |
| ⏸ **Smart Resume / Pause** | Stop a running generation safely; retry seamlessly picks up from the last completed agent |
| 📊 **Analytics Dashboard** | Live telemetry: total sessions, completed analyses, memories stored, repos generated |
| 🔄 **Automated Resilience** | Exponential backoff and retry mechanisms for bulletproof AI integration |

---

## 🏗 Architecture Overview

FounderAI operates on a robust, decoupled enterprise architecture designed for zero-latency streaming and high fault tolerance.

```mermaid
graph TB
    subgraph Browser["Frontend (React 19 + Framer Motion)"]
        UI["Dark Mode UI"]
        RQ["TanStack Query"]
        SSE["SSE Data Stream"]
        UI --> RQ
        UI --> SSE
    end

    subgraph API["Backend API (Express 5)"]
        direction TB
        ROUTES["REST Controllers"]
        STREAM["POST /sessions/:id/run"]
        ROUTES --> STREAM
    end

    subgraph Agents["Sequential Agent Pipeline"]
        direction LR
        O["🧭 Orchestrator"]
        R["🔬 Market Research"]
        B["📋 Business Plan"]
        M["🛠 MVP Architect"]
        O --> R --> B --> M
    end

    subgraph Gemini["Google Gemini 3.6 Flash"]
        GEN["Structured JSON LLM"]
        EMBED["Vector Embeddings"]
    end

    subgraph Storage["MongoDB Atlas"]
        SESSIONS[("Sessions")]
        VECTOR["$vectorSearch"]
    end

    subgraph GitLab["GitLab Automation"]
        REPO["Create Project"]
        COMMIT["Commit Files"]
    end

    Browser -->|HTTP + SSE| API
    STREAM -->|Triggers| Agents
    Agents -->|Inferences| Gemini
    Gemini -->|Vectors| Storage
    Agents -->|Saves State| Storage
    M -->|Publishes| GitLab
```

---

## 🤖 The Multi-Agent Pipeline

The four agents run **sequentially**. Each agent receives the previous agent's typed output as context. This strictly eliminates AI hallucinations and ensures every downstream architectural decision is grounded in factual market research.

1. **🧭 Orchestrator Agent**: Deconstructs the idea. Defines the core problem, target audience, and engineering tech stack.
2. **🔬 Market Research Agent**: Calculates TAM/CAGR, identifies real-world competitors, and formulates a Go-To-Market (GTM) strategy.
3. **📋 Business Plan Agent**: Drafts a comprehensive, investor-ready plan with 3-year financial projections and hiring milestones.
4. **🛠 MVP Architect**: Generates the actual boilerplate application code (React, Node, etc.) and seamlessly commits it to GitLab.

---

## 🛠 Tech Stack

Designed with modern, cutting-edge tooling for maximum performance.

### Backend Infrastructure
* **Runtime**: Node.js 20+ (ESM)
* **Framework**: Express 5 (Async-native)
* **AI Engine**: Google Gemini 3.6 Flash
* **Vector Database**: MongoDB Atlas (`$vectorSearch`)
* **Validation**: Zod (Strict TypeScript schemas)

### Frontend Experience
* **Framework**: React 19 + Vite 6
* **Styling**: Tailwind CSS v4 (Sleek Dark Mode aesthetics)
* **Animations**: Framer Motion (Dynamic, fluid state transitions)
* **State Management**: TanStack Query v5

---

## 🚀 Quick Start Guide

Run FounderAI locally and experience the multi-agent automation yourself.

### 1. Clone & Install
```bash
git clone https://github.com/muhammad-hameed-ai/FounderAI.git
cd FounderAI
pnpm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```bash
# Critical APIs
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/founderai

# GitLab Automation (Required for MVP auto-commit)
GITLAB_TOKEN=glpat-your-personal-access-token
GITLAB_USERNAME=your-gitlab-username

# Security
SESSION_SECRET=super_secure_random_string
```

### 3. Launch the Platform
```bash
# Terminal 1 — Start the API Server (Port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Start the Frontend UI (Port 5173)
pnpm --filter @workspace/founder-ai run dev
```
Open **`http://localhost:5173`** in your browser and deploy your first startup!

---

## ☁️ Deployment on Render

FounderAI is fully optimized for production deployment on Render.com via the included `render.yaml` blueprint.

1. Push your repository to GitHub.
2. In the Render Dashboard, click **New** → **Blueprint** and connect your repository.
3. Render will automatically spin up two services:
   * **`founderai-api`** (Node.js Web Service)
   * **`founderai-frontend`** (Static Site)
4. Add your `.env` variables to the `founderai-api` service in the Render dashboard.
5. Set `VITE_API_URL` on the frontend service to point to your live API.

---

## 🧠 MongoDB Atlas Vector Search Setup

To enable the RAG semantic memory features, you must configure a Vector Index on your MongoDB cluster.

1. Go to your MongoDB Atlas dashboard.
2. Navigate to **Atlas Search** and select the **JSON Editor**.
3. Apply the following index definition to the `memories` collection:

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

---

<div align="center">
  <i>Engineered for the future of AI-driven software development.</i>
</div>

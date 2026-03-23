# AGENTS.md

This file provides guidelines for agentic coding agents working in this repository.

## Language Preference

**All communication with the user must be in Russian language only.**

## Project Overview

Eggent is a Next.js application for creating AI agents with skills and tools. Key concepts:
- **Agents** - AI models with available tools
- **Skills** - Markdown instructions (`bundled-skills/*/SKILL.md`)
- **Tools** - Executable capabilities (code_execution, memory, knowledge, search, etc.)

## Build/Lint/Test Commands

```bash
# Development
npm install              # Install dependencies
npm run dev              # Development server (http://localhost:3000)
npm run build            # Production build (Next.js with Turbopack)
npm run start            # Production server (after build)
npm run lint             # ESLint (next/core-web-vitals config)

# Health check
curl http://localhost:3000/api/health

# Docker development
docker compose up --build
docker compose build --no-cache app   # After dependency changes!
docker compose logs -f app
docker compose restart app
docker compose down
```

**Note:** No automated test framework. Manual testing via health endpoint and UI.

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/                    # API endpoints
│   │   ├── chat/           # Main AI request endpoint
│   │   ├── projects/       # Project management
│   │   └── integrations/   # Telegram, external systems
│   └── dashboard/           # UI pages
├── lib/                    # Business logic
│   ├── agent/              # runAgent() - main AI entry point
│   ├── tools/              # Tool implementations
│   ├── memory/             # Vector DB and knowledge base
│   ├── storage/            # Persistent storage (chats, settings)
│   ├── providers/          # AI providers (OpenAI, Anthropic, Google)
│   └── types.ts            # Core type definitions
├── prompts/                # System prompts (tool-*.md, system.md)
├── components/             # React components
├── hooks/                  # Custom React hooks
└── store/                  # Zustand state management
bundled-skills/             # Built-in skill packs
data/                       # Local storage (git-ignored)
```

## Code Style Guidelines

### Imports
```typescript
// 1. External packages (Node.js, npm)
import { streamText, generateText } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// 2. Internal aliases (@/ for src/)
import { getSettings } from "@/lib/storage/settings-store";
import type { AppSettings, ChatMessage } from "@/lib/types";
import { runAgent } from "@/lib/agent/agent";
```

### TypeScript
- **Strict mode enabled** with `noUnusedLocals`, `noUnusedParameters`
- **Target:** ES2020, module: ESNext, bundler resolution
- **Path alias:** `@/*` maps to `./src/*`

```typescript
// Types: Use 'interface' for objects, 'type' for unions/primitives
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

```

### Constants
```typescript
// File-level constants: UPPER_SNAKE_CASE at top of file
const MAX_TOOL_STEPS_PER_TURN = 15;
const CODE_EXEC_MAX_CHARS = 20000;
```

### Functions
```typescript
// Helper functions before main functions
// camelCase naming
function resolveContextCwd(context: AgentContext): string {
  const baseDir = getWorkDir(context.projectId);
  // ...
  return baseDir;
}

// Async functions use async/await
export async function getSettings(): Promise<AppSettings> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}
```

### Error Handling
```typescript
// Use try-catch with instanceof Error check
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  return `Failed: ${error instanceof Error ? error.message : String(error)}`;
}

// For API routes
export async function POST(req: NextRequest) {
  try {
    // ...
    return Response.json({ success: true, data });
  } catch (error) {
    console.error("API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Tool Definitions (Zod + AI SDK)
```typescript
import { tool } from "ai";
import { z } from "zod";

export const myTool = tool({
  description: "Tool description for the LLM",
  parameters: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().default(10),
  }),
  execute: async ({ query, limit }) => {
    // Implementation
    return `Result for: ${query}`;
  },
});
```

### React Components
```tsx
"use client";

import { useState, useEffect } from "react";
import { SomeComponent } from "@/components/some-component";
import { useAppStore } from "@/store/app-store";

interface ComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: ComponentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const settings = useAppStore((state) => state.settings);

  useEffect(() => {
    // Effect logic
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1>{title}</h1>
    </div>
  );
}
```

### Storage Pattern (File-based JSON)
```typescript
const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings", "settings.json");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}
```

### Zustand Store Pattern
```typescript
"use client";

import { create } from "zustand";
import type { SomeItem } from "@/lib/types";

interface AppState {
  items: SomeItem[];
  activeId: string | null;
  setItems: (items: SomeItem[]) => void;
  setActiveId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  items: [],
  activeId: null,
  setItems: (items) => set({ items }),
  setActiveId: (id) => set({ activeId: id }),
}));
```

---

## Key Patterns

### Telegram Integration
- **Webhook:** `/api/integrations/telegram/webhook`
- **Per-user timezone:** Stored in `data/user-preferences/<userId>.json`
- **Per-session timezone:** Stored in `data/external-sessions/<sessionId>.json`
- **Language → Timezone mapping:** `src/lib/utils/language-timezone-map.ts`
- **Timezone confirmation:** Inline buttons on first message (if language detected with high confidence)
- **Callback handling:** Button responses via `callback_query`
- **Copy on `/new`:** Preferences copied to new session

### MCP (Model Context Protocol)
- **Config location:** `data/projects/<project-id>/.meta/mcp/servers.json`
- **Cursor-compatible format:** Uses `mcpServers` key in JSON
- **Client implementation:** `src/lib/mcp/client.ts`

### Memory & Knowledge System
- **Memory storage:** `data/memory/<memory-subdir>/vectors.json`
- **Knowledge base:** Indexed from `data/projects/<project-id>/.meta/knowledge/`
- **Supported file types:** `.txt`, `.md`, `.pdf`, `.docx`, `.xlsx`, audio files (with transcription)

---

## Important Notes

- **Never commit secrets** to `.env` or `data/`
- **Always use `@/` imports** for internal modules
- **Type everything explicitly** - no `any` unless truly necessary
- **Handle errors gracefully** with user-friendly messages
- **Use structured logging** with `console.log`/`console.error`
- **Docker rebuilds need `--no-cache`** after dependency changes

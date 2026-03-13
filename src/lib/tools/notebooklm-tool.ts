/**
 * NotebookLM Tool for Eggent
 * Direct integration with NotebookLM via notebooklm-py
 */

import { tool } from "ai";
import { z } from "zod";
import { executeCode } from "@/lib/tools/code-execution";
import type { AgentContext } from "@/lib/agent/types";

const NOTEBOOKLM_SKILL_DIR = "/home/takeshi/.eggent/bundled-skills/notebooklm";
const NOTEBOOKLM_VENV = `${NOTEBOOKLM_SKILL_DIR}/.venv/bin/python`;

/**
 * Execute a notebooklm skill script
 */
async function runNotebooklmScript(
  script: string,
  args: string[],
  context: AgentContext
): Promise<{ success: boolean; output: string; error?: string }> {
  const scriptPath = `${NOTEBOOKLM_SKILL_DIR}/scripts/${script}.py`;

  const code = `
import subprocess
import sys

result = subprocess.run(
  ["${NOTEBOOKLM_VENV}", "${scriptPath}"] + ${JSON.stringify(args)},
  capture_output=True,
  text=True,
  cwd="${NOTEBOOKLM_SKILL_DIR}"
)

if result.returncode == 0:
  print(result.stdout)
  sys.exit(0)
else:
  print(result.stderr, file=sys.stderr)
  print(result.stdout)
  sys.exit(result.returncode)
`;

  const result = await executeCode(
    code,
    "python",
    context,
    false, // background
    undefined, // sessionId
    60000 // timeout (ms)
  );

  if (result.exitCode === 0) {
    return { success: true, output: result.output || "" };
  } else {
    return {
      success: false,
      output: result.output || "",
      error: result.error || `Exit code: ${result.exitCode}`
    };
  }
}

/**
 * NotebookLM Query Tool
 * Ask a question to your NotebookLM notebook
 */
export const notebooklmQuery = tool({
  description: `
Query a Google NotebookLM notebook for source-grounded, citation-backed answers.
Use this when the user wants to:
- Ask questions about their documentation
- Get information from uploaded documents
- Query their knowledge base with minimal hallucinations
- Retrieve specific information from their notebooks

Examples:
- "What does my React docs say about hooks?"
- "Check my API documentation about authentication"
- "Summarize my research papers on AI"
`,
  parameters: z.object({
    question: z.string().describe("The question to ask NotebookLM"),
    notebookId: z.string().optional().describe("Notebook ID (optional if active notebook is set)"),
    notebookUrl: z.string().optional().describe("Full NotebookLM URL"),
    useOptimized: z.boolean().default(true).describe("Use optimized query with caching (recommended)"),
    showBrowser: z.boolean().default(false).describe("Show browser for debugging"),
  }),
  execute: async (params, context) => {
    const { question, notebookId, notebookUrl, useOptimized, showBrowser } = params;

    // Build args
    const args = ["--question", question];
    if (notebookId) args.push("--notebook-id", notebookId);
    if (notebookUrl) args.push("--notebook-url", notebookUrl);
    if (showBrowser) args.push("--show-browser");

    // Choose script version
    const script = useOptimized ? "run.py" : "run.py";
    const scriptArgs = useOptimized
      ? [useOptimized ? "ask_question_optimized.py" : "ask_question.py", ...args]
      : ["ask_question.py", ...args];

    const result = await runNotebooklmScript(script, scriptArgs, context);

    if (!result.success) {
      return {
        error: result.error || "Failed to query NotebookLM",
        success: false
      };
    }

    return {
      answer: result.output,
      success: true,
      cached: result.output.includes("💾"), // Cached indicator
    };
  }
});

/**
 * NotebookLM Library Management Tool
 * Manage your notebook library
 */
export const notebooklmLibrary = tool({
  description: `
Manage your Google NotebookLM notebook library.
Use this to:
- List all notebooks in your library
- Add a new notebook URL to your library
- Set an active notebook for queries
- Search notebooks by topic
`,
  parameters: z.object({
    action: z.enum(["list", "add", "activate", "search", "remove"]).describe("Action to perform"),
    notebookUrl: z.string().optional().describe("Notebook URL (for add/remove)"),
    name: z.string().optional().describe("Notebook name (for add)"),
    description: z.string().optional().describe("Notebook description (for add)"),
    topics: z.string().optional().describe("Comma-separated topics (for add)"),
    notebookId: z.string().optional().describe("Notebook ID (for activate/remove)"),
    query: z.string().optional().describe("Search query (for search)"),
  }),
  execute: async (params, context) => {
    const { action } = params;

    const args: string[] = [];

    if (action === "list") {
      args.push("list");
    } else if (action === "add") {
      if (!params.notebookUrl || !params.name || !params.description) {
        return {
          error: "For add action, need: notebookUrl, name, description",
          success: false
        };
      }
      args.push("add");
      args.push("--url", params.notebookUrl);
      args.push("--name", params.name);
      args.push("--description", params.description);
      if (params.topics) args.push("--topics", params.topics);
    } else if (action === "activate") {
      if (!params.notebookId) {
        return { error: "Need notebookId for activate action", success: false };
      }
      args.push("activate");
      args.push("--id", params.notebookId);
    } else if (action === "search") {
      if (!params.query) {
        return { error: "Need query for search action", success: false };
      }
      args.push("search");
      args.push("--query", params.query);
    } else if (action === "remove") {
      if (!params.notebookId) {
        return { error: "Need notebookId for remove action", success: false };
      }
      args.push("remove");
      args.push("--id", params.notebookId);
    }

    const result = await runNotebooklmScript("run.py", ["notebook_manager.py", ...args], context);

    if (!result.success) {
      return {
        error: result.error || "Failed to manage library",
        success: false
      };
    }

    return {
      output: result.output,
      success: true
    };
  }
});

/**
 * NotebookLM Authentication Tool
 * Manage Google authentication for NotebookLM
 */
export const notebooklmAuth = tool({
  description: `
Manage Google authentication for NotebookLM.
Use this to:
- Check authentication status
- Setup authentication (opens browser)
- Clear authentication data
- Re-authenticate
`,
  parameters: z.object({
    action: z.enum(["status", "setup", "clear", "reauth"]).describe("Action to perform"),
  }),
  execute: async (params, context) => {
    const { action } = params;

    const result = await runNotebooklmScript("run.py", ["auth_manager.py", action], context);

    if (!result.success) {
      return {
        error: result.error || "Failed to manage authentication",
        success: false
      };
    }

    return {
      output: result.output,
      success: true
    };
  }
});

/**
 * NotebookLM Cache Management Tool
 * Manage query cache and statistics
 */
export const notebooklmCache = tool({
  description: `
Manage NotebookLM query cache and rate limiting statistics.
Use this to:
- View cache statistics
- Clear cached queries
- Clean up expired entries
- View rate limiting info
`,
  parameters: z.object({
    action: z.enum(["stats", "clear", "cleanup"]).describe("Action to perform"),
  }),
  execute: async (params, context) => {
    const { action } = params;

    const result = await runNotebooklmScript("run.py", ["cache_manager.py", action], context);

    if (!result.success) {
      return {
        error: result.error || "Failed to manage cache",
        success: false
      };
    }

    return {
      output: result.output,
      success: true
    };
  }
});

/**
 * Export all NotebookLM tools
 */
export const notebooklmTools = {
  notebooklmQuery,
  notebooklmLibrary,
  notebooklmAuth,
  notebooklmCache,
};

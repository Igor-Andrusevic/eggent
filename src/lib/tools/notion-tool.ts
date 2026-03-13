/**
 * Notion tool - умная обёртка вокруг Notion MCP для упрощённого создания страниц
 *
 * Особенности:
 * - Автоматический поиск родительской страницы по названию
 * - Создание в workspace root если родитель не найден
 * - Упрощённый API для создания страниц
 */

import { connectMcpServer, callMcpTool, listMcpTools, closeMcpConnection } from "@/lib/mcp/client";
import type { McpServerConfig } from "@/lib/types";

/**
 * Найти Notion MCP сервер в конфигурации проекта
 */
function findNotionMcpServer(servers: McpServerConfig[]): McpServerConfig | null {
  return servers.find(
    (server) =>
      server.id === "notion" ||
      server.command?.includes("notion-mcp-server")
  ) || null;
}

/**
 * Выполнить поиск в Notion для поиска родительской страницы/базы данных
 */
async function searchNotion(
  mcpConfig: McpServerConfig,
  query: string,
  filter?: { object?: string }
): Promise<{ id: string; title: string; object: string }[]> {
  const conn = await connectMcpServer(mcpConfig);
  if (!conn) {
    throw new Error("Failed to connect to Notion MCP server");
  }

  try {
    const tools = await listMcpTools(conn.client);
    const searchTool = tools.find(t => t.name === "search" || t.name.includes("search"));

    if (!searchTool) {
      throw new Error("Search tool not found in Notion MCP server");
    }

    // Build the tool name (mcp_notion_search or similar)
    const toolName = `mcp_${mcpConfig.id}_${searchTool.name}`;
    const args: Record<string, unknown> = { query };

    if (filter?.object) {
      args.filter = filter;
    }

    const result = await callMcpTool(conn.client, searchTool.name, args);
    const parsed = JSON.parse(result);

    if (parsed.object === "list" && Array.isArray(parsed.results)) {
      return parsed.results.map((r: any) => ({
        id: r.id,
        title: r.title?.[0]?.plain_text || r.properties?.Name?.title?.[0]?.plain_text || "Untitled",
        object: r.object
      }));
    }

    return [];
  } finally {
    await closeMcpConnection(conn);
  }
}

/**
 * Создать страницу в Notion (внутренняя функция)
 */
async function createNotionPageInternal(
  mcpConfig: McpServerConfig,
  options: {
    title: string;
    content?: string;
    parentId?: string;
    parentType?: "page_id" | "database_id" | "workspace";
  }
): Promise<{ success: boolean; pageId?: string; url?: string; error?: string }> {
  const conn = await connectMcpServer(mcpConfig);
  if (!conn) {
    return { success: false, error: "Failed to connect to Notion MCP server" };
  }

  try {
    const tools = await listMcpTools(conn.client);
    const createPageTool = tools.find(t => t.name.includes("page") && (t.name.includes("create") || t.name.includes("post")));

    if (!createPageTool) {
      return { success: false, error: "Create page tool not found in Notion MCP server" };
    }

    // Build parent object
    let parent: Record<string, unknown>;
    if (options.parentId) {
      if (options.parentType === "database_id") {
        parent = { database_id: options.parentId };
      } else {
        parent = { page_id: options.parentId };
      }
    } else {
      // Create in workspace root
      parent = { type: "workspace", workspace: true };
    }

    // Build properties (title)
    const args: Record<string, unknown> = {
      parent,
      properties: {
        title: {
          title: [
            {
              text: {
                content: options.title
              }
            }
          ]
        }
      }
    };

    // Add content if provided
    if (options.content) {
      args.children = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: options.content }
              }
            ]
          }
        }
      ];
    }

    const result = await callMcpTool(conn.client, createPageTool.name, args);
    const parsed = JSON.parse(result);

    if (parsed.id) {
      // Extract page ID and construct URL
      const pageId = parsed.id;
      const url = `https://notion.so/${pageId.replace(/-/g, "")}`;
      return { success: true, pageId, url };
    }

    return { success: false, error: "Failed to create page: " + result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await closeMcpConnection(conn);
  }
}

/**
 * Создать Notion страницу с автоматическим поиском родителя
 *
 * Алгоритм:
 * 1. Если указан parent_id → создать страницу с этим родителем
 * 2. Если указан parent_name → найти страницу по названию и создать внутри неё
 * 3. Если родитель не найден или не указан → создать в workspace root
 */
export async function createNotionPage(
  mcpServers: McpServerConfig[],
  options: {
    title: string;
    content?: string;
    parentId?: string;
    parentName?: string;
    parentType?: "page" | "database" | "workspace";
  }
): Promise<string> {
  // Find Notion MCP server
  const notionMcp = findNotionMcpServer(mcpServers);
  if (!notionMcp) {
    return "Error: Notion MCP server not configured. Please add Notion to your project's MCP servers.";
  }

  try {
    let parentId: string | undefined;
    let parentType: "page_id" | "database_id" | "workspace" = "workspace";

    // Case 1: Direct parent ID provided
    if (options.parentId) {
      parentId = options.parentId;
      parentType = options.parentType === "database" ? "database_id" : "page_id";
    }
    // Case 2: Parent name provided - search for it
    else if (options.parentName) {
      const searchResults = await searchNotion(notionMcp, options.parentName, { object: "page" });

      if (searchResults.length > 0) {
        parentId = searchResults[0].id;
        parentType = "page_id";

        // Create the page
        const result = await createNotionPageInternal(notionMcp, {
          title: options.title,
          content: options.content,
          parentId,
          parentType
        });

        if (result.success) {
          return `✅ Page created successfully in "${searchResults[0].title}"\n\n📝 Page: ${result.url}`;
        } else {
          return `❌ Failed to create page: ${result.error}`;
        }
      } else {
        // Parent not found - create in workspace root
        const result = await createNotionPageInternal(notionMcp, {
          title: options.title,
          content: options.content,
          parentType: "workspace"
        });

        if (result.success) {
          return `⚠️ Parent "${options.parentName}" not found. Created in workspace root instead.\n\n📝 Page: ${result.url}`;
        } else {
          return `❌ Failed to create page: ${result.error}`;
        }
      }
    }
    // Case 3: No parent specified - create in workspace root
    else {
      const result = await createNotionPageInternal(notionMcp, {
        title: options.title,
        content: options.content,
        parentType: "workspace"
      });

      if (result.success) {
        return `✅ Page created in workspace root\n\n📝 Page: ${result.url}`;
      } else {
        return `❌ Failed to create page: ${result.error}`;
      }
    }

    // Fallback: create with found parent ID
    if (parentId) {
      const result = await createNotionPageInternal(notionMcp, {
        title: options.title,
        content: options.content,
        parentId,
        parentType
      });

      if (result.success) {
        return `✅ Page created successfully\n\n📝 Page: ${result.url}`;
      } else {
        return `❌ Failed to create page: ${result.error}`;
      }
    }

    return "❌ Failed to create page: Unknown error";
  } catch (error) {
    return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Поиск страниц и баз данных в Notion
 */
export async function searchNotionPages(
  mcpServers: McpServerConfig[],
  query: string,
  filter?: { object?: "page" | "database" }
): Promise<string> {
  const notionMcp = findNotionMcpServer(mcpServers);
  if (!notionMcp) {
    return "Error: Notion MCP server not configured.";
  }

  try {
    const results = await searchNotion(notionMcp, query, filter);

    if (results.length === 0) {
      return `No results found for "${query}"`;
    }

    const formatted = results.map((r, i) =>
      `[${i + 1}] ${r.object === "page" ? "📄" : "🗃️"} ${r.title}\n    ID: ${r.id}`
    ).join("\n\n");

    return `Found ${results.length} result${results.length > 1 ? "s" : ""}:\n\n${formatted}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

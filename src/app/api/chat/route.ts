import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent/agent";
import { createChat, getChat } from "@/lib/storage/chat-store";
import { ensureCronSchedulerStarted } from "@/lib/cron/runtime";

export const maxDuration = 300; // 5 min max for long agent runs

function formatChatStreamError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Generation failed after tool execution. Please retry.";
  }
  const short = compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
  return `Generation failed after tool execution: ${short}`;
}

const SSE_HEARTBEAT_INTERVAL_MS = 15000;

function withSseHeartbeat(
  stream: ReadableStream<Uint8Array>,
  intervalMs = SSE_HEARTBEAT_INTERVAL_MS
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  let timer: ReturnType<typeof setInterval> | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          if (timer) {
            clearInterval(timer);
            timer = undefined;
          }
        }
      }, intervalMs);

      const pump = (): void => {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              if (timer) {
                clearInterval(timer);
                timer = undefined;
              }
              try {
                controller.close();
              } catch {
                // already closed
              }
              return;
            }
            if (value) {
              controller.enqueue(value);
            }
            pump();
          })
          .catch((error) => {
            if (timer) {
              clearInterval(timer);
              timer = undefined;
            }
            try {
              controller.error(error);
            } catch {
              // already errored or closed
            }
          });
      };

      pump();
    },
    cancel(reason) {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      return reader.cancel(reason);
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    await ensureCronSchedulerStarted();
    const body = await req.json();
    const { chatId, projectId, currentPath, userTimezone, userLocale } = body;
    let message: string | undefined = body.message;

    // Support AI SDK's DefaultChatTransport format which sends a `messages` array
    if (!message && Array.isArray(body.messages)) {
      const lastUserMsg = [...body.messages]
        .reverse()
        .find((m: Record<string, unknown>) => m.role === "user");
      if (lastUserMsg) {
        if (typeof lastUserMsg.content === "string") {
          message = lastUserMsg.content;
        } else if (Array.isArray(lastUserMsg.parts)) {
          message = lastUserMsg.parts
            .filter((p: Record<string, unknown>) => p.type === "text")
            .map((p: Record<string, string>) => p.text)
            .join("");
        }
      }
    }

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Create chat if needed
    let resolvedChatId = chatId;
    if (!resolvedChatId) {
      resolvedChatId = crypto.randomUUID();
      await createChat(resolvedChatId, "New Chat", projectId);
    } else {
      const existing = await getChat(resolvedChatId);
      if (!existing) {
        await createChat(resolvedChatId, "New Chat", projectId);
      }
    }

    // Run agent and return streaming response
    const result = await runAgent({
      chatId: resolvedChatId,
      userMessage: message,
      projectId,
      currentPath: typeof currentPath === "string" ? currentPath : undefined,
      userTimezone: typeof userTimezone === "string" ? userTimezone : undefined,
      userLocale: typeof userLocale === "string" ? userLocale : undefined,
    });

    const uiResponse = result.toUIMessageStreamResponse({
      headers: {
        "X-Chat-Id": resolvedChatId,
        "Cache-Control": "no-cache, no-transform",
      },
      onError: (error) => {
        console.error("Chat stream response error:", error);
        return formatChatStreamError(error);
      },
    });

    if (!uiResponse.body) {
      return uiResponse;
    }

    return new Response(withSseHeartbeat(uiResponse.body), {
      status: uiResponse.status,
      statusText: uiResponse.statusText,
      headers: uiResponse.headers,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    if (errorMessage.includes("Insufficient balance") || errorMessage.includes("Please recharge")) {
      return Response.json(
        {
          error: "Недостаточно баланса на аккаунте AI-провайдера. Пожалуйста, пополните счёт.",
        },
        { status: 429 }
      );
    }
    
    return Response.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

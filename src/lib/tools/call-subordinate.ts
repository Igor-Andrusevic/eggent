import type { ModelMessage } from "ai";

import {
  isRetriableProviderError,
  formatProviderError,
} from "@/lib/agent/error-utils";

const MAX_SUBORDINATE_CONCURRENCY = 2;
const SUBORDINATE_RETRY_DELAYS_MS = [1000, 2500] as const;

let activeSubordinateCalls = 0;
const subordinateWaitQueue: Array<() => void> = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireSubordinateSlot(): Promise<void> {
  if (activeSubordinateCalls < MAX_SUBORDINATE_CONCURRENCY) {
    activeSubordinateCalls += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    subordinateWaitQueue.push(() => resolve());
  });
}

function releaseSubordinateSlot(): void {
  const next = subordinateWaitQueue.shift();
  if (next) {
    next();
    return;
  }

  activeSubordinateCalls = Math.max(0, activeSubordinateCalls - 1);
}

async function withSubordinateSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSubordinateSlot();
  try {
    return await fn();
  } finally {
    releaseSubordinateSlot();
  }
}

async function runSubordinateWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= SUBORDINATE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === SUBORDINATE_RETRY_DELAYS_MS.length;
      if (isLastAttempt || !isRetriableProviderError(error)) {
        throw error;
      }
      const delay = SUBORDINATE_RETRY_DELAYS_MS[attempt] ?? 1000;
      await sleep(delay + Math.floor(Math.random() * 400));
    }
  }

  throw new Error("Subordinate retry loop exited unexpectedly");
}

/**
 * Delegate a task to a subordinate agent
 */
export async function callSubordinate(
  task: string,
  projectId: string | undefined,
  parentAgentNumber: number,
  parentHistory: ModelMessage[]
): Promise<string> {
  try {
    // Dynamic import to avoid circular dependency
    const { runSubordinateAgent } = await import("@/lib/agent/agent");

    const result = await withSubordinateSlot(() =>
      runSubordinateWithRetry(() =>
        runSubordinateAgent({
          task,
          projectId,
          parentAgentNumber,
          parentHistory,
        })
      )
    );

    return `Subordinate Agent ${parentAgentNumber + 1} completed the task:\n\n${result}`;
  } catch (error) {
    return `Subordinate agent error: ${formatProviderError(error)}`;
  }
}

/**
 * Shared error classification and formatting utilities for AI provider calls.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function getStatusCode(error: unknown): number | null {
  const queue = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const record = asRecord(current);
    if (!record) {
      continue;
    }

    const rawStatus = record.statusCode ?? record.status ?? record.status_code;
    if (typeof rawStatus === "number" && Number.isFinite(rawStatus)) {
      return rawStatus;
    }
    if (typeof rawStatus === "string") {
      const parsed = Number.parseInt(rawStatus, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    if (record.cause) {
      queue.push(record.cause);
    }
    if (record.responseBody) {
      queue.push(record.responseBody);
    }
    if (record.data) {
      queue.push(record.data);
    }
    if (record.error) {
      queue.push(record.error);
    }
  }

  return null;
}

export function getErrorCode(error: unknown): string | null {
  const queue = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const record = asRecord(current);
    if (!record) {
      continue;
    }

    const rawCode = record.code ?? record.type;
    if (typeof rawCode === "string" && rawCode.trim()) {
      return rawCode.trim();
    }

    if (record.cause) {
      queue.push(record.cause);
    }
    if (record.responseBody) {
      queue.push(record.responseBody);
    }
    if (record.data) {
      queue.push(record.data);
    }
    if (record.error) {
      queue.push(record.error);
    }
  }

  return null;
}

export function getErrorDetail(error: unknown): string | null {
  const queue = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (typeof current === "string" && current.trim()) {
      const detail = current.trim().replace(/\s+/g, " ");
      return detail.length > 280 ? `${detail.slice(0, 280)}...` : detail;
    }

    const record = asRecord(current);
    if (!record) {
      continue;
    }

    const rawMessage = record.message;
    if (typeof rawMessage === "string" && rawMessage.trim()) {
      const detail = rawMessage.trim().replace(/\s+/g, " ");
      return detail.length > 280 ? `${detail.slice(0, 280)}...` : detail;
    }

    if (record.cause) {
      queue.push(record.cause);
    }
    if (record.responseBody) {
      queue.push(record.responseBody);
    }
    if (record.data) {
      queue.push(record.data);
    }
    if (record.error) {
      queue.push(record.error);
    }
  }

  return null;
}

export function isRetriableProviderError(error: unknown): boolean {
  const statusCode = getStatusCode(error);
  if (statusCode !== null) {
    return statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500;
  }

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("provider returned error") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("temporarily unavailable") ||
    message.includes("overloaded") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("model_cooldown") ||
    message.includes("cooling down")
  );
}

export function formatProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const statusCode = getStatusCode(error);
  const code = getErrorCode(error);
  const detail = getErrorDetail(error);

  const details: string[] = [];
  if (statusCode !== null) {
    details.push(`status=${statusCode}`);
  }
  if (code) {
    details.push(`code=${code}`);
  }

  const base = details.length > 0 ? `${message} (${details.join(", ")})` : message;
  if (!detail || detail === message) {
    return base;
  }
  return `${base}: ${detail}`;
}

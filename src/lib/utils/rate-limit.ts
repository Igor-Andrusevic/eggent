interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Next.js hot-reload persistence
const globalAny = global as any;
const limits: Map<string, RateLimitRecord> = globalAny.telegramRateLimits || new Map();
if (!globalAny.telegramRateLimits) {
  globalAny.telegramRateLimits = limits;
}

/**
 * Проверяет, не был ли превышен лимит попыток для заданного идентификатора.
 * Возвращает true, если лимит не превышен, и false, если доступ заблокирован.
 */
export function checkRateLimit(identifier: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  
  // Периодическая сборка «мусора»
  if (Math.random() < 0.1) {
    for (const [key, record] of limits.entries()) {
      if (now > record.resetAt) {
        limits.delete(key);
      }
    }
  }

  const record = limits.get(identifier);
  if (!record || now > record.resetAt) {
    limits.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count += 1;
  return true;
}

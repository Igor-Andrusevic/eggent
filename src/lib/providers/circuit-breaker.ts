/**
 * In-memory Circuit Breaker for LLM models/providers.
 * Tracks failure counts per model key and temporarily trips open
 * to avoid wasting timeouts on consistently failing models.
 */

export enum CircuitState {
  CLOSED = "closed",       // Normal operation: model is healthy
  OPEN = "open",           // Tripped: model is failing, skip calls
  HALF_OPEN = "half_open", // Cooldown passed: allow single trial probe
}

interface CircuitEntry {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RESET_TIMEOUT_MS = 120_000; // 2 minutes cooldown

export class ModelCircuitBreaker {
  private entries = new Map<string, CircuitEntry>();
  private failureThreshold: number;
  private resetTimeoutMs: number;

  constructor(options?: { failureThreshold?: number; resetTimeoutMs?: number }) {
    this.failureThreshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
  }

  private getOrCreateEntry(key: string): CircuitEntry {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        state: CircuitState.CLOSED,
        consecutiveFailures: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      };
      this.entries.set(key, entry);
    }
    return entry;
  }

  /**
   * Check if a model is available to receive requests.
   * If OPEN and cooldown has expired, transitions to HALF_OPEN.
   */
  public isAvailable(key: string): boolean {
    const entry = this.getOrCreateEntry(key);

    if (entry.state === CircuitState.CLOSED) {
      return true;
    }

    if (entry.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - entry.lastFailureTime >= this.resetTimeoutMs) {
        entry.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN allows probe
    return true;
  }

  /**
   * Record a successful response from a model.
   * Closes the circuit and resets consecutive failure counter.
   */
  public recordSuccess(key: string): void {
    const entry = this.getOrCreateEntry(key);
    entry.consecutiveFailures = 0;
    entry.lastSuccessTime = Date.now();
    entry.totalSuccesses += 1;
    if (entry.state !== CircuitState.CLOSED) {
      entry.state = CircuitState.CLOSED;
      console.info(`[CircuitBreaker] Circuit CLOSED for "${key}" (recovered).`);
    }
  }

  /**
   * Record a failure for a model.
   * If failures reach threshold (or if probe fails in HALF_OPEN), trips to OPEN.
   */
  public recordFailure(key: string, reason?: string): void {
    const entry = this.getOrCreateEntry(key);
    const now = Date.now();
    entry.consecutiveFailures += 1;
    entry.lastFailureTime = now;
    entry.totalFailures += 1;

    if (entry.state === CircuitState.HALF_OPEN || entry.consecutiveFailures >= this.failureThreshold) {
      entry.state = CircuitState.OPEN;
      console.warn(
        `[CircuitBreaker] Circuit OPEN for "${key}" after ${entry.consecutiveFailures} consecutive failure(s). ${reason ? `Reason: ${reason}. ` : ""}Cooldown: ${Math.round(this.resetTimeoutMs / 1000)}s.`
      );
    }
  }

  /**
   * Get the current state of a model's circuit.
   */
  public getState(key: string): CircuitState {
    const entry = this.getOrCreateEntry(key);
    if (entry.state === CircuitState.OPEN && Date.now() - entry.lastFailureTime >= this.resetTimeoutMs) {
      return CircuitState.HALF_OPEN;
    }
    return entry.state;
  }

  /**
   * Reset the circuit for a specific model or all models.
   */
  public reset(key?: string): void {
    if (key) {
      this.entries.delete(key);
    } else {
      this.entries.clear();
    }
  }
}

/** Global singleton instance */
export const modelCircuitBreaker = new ModelCircuitBreaker();

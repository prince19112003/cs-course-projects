export interface RateLimitStatus {
  allowed: boolean;
  lockoutRemainingMs?: number;
  reason?: string;
  consecutiveFailures: number;
}

interface FailureRecord {
  failures: number;
  lastFailureTime: number;
  lockedUntil?: number;
}

export class RateLimiter {
  private static attempts = new Map<string, FailureRecord>();

  /**
   * Checks whether an identifier (email/phone) is allowed to attempt login.
   */
  static checkRateLimit(identifier: string): RateLimitStatus {
    const key = identifier.toLowerCase().trim();
    const record = this.attempts.get(key);

    if (!record) {
      return { allowed: true, consecutiveFailures: 0 };
    }

    const now = Date.now();

    // Check if currently locked out
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingMs = record.lockedUntil - now;
      if (record.failures >= 10) {
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return {
          allowed: false,
          lockoutRemainingMs: remainingMs,
          consecutiveFailures: record.failures,
          reason: `Account locked due to consecutive failed attempts. Please try again in ${remainingMinutes} minute(s).`,
        };
      } else {
        const remainingSec = Math.ceil(remainingMs / 1000);
        return {
          allowed: false,
          lockoutRemainingMs: remainingMs,
          consecutiveFailures: record.failures,
          reason: `Too many failed attempts. Please wait ${remainingSec} second(s) before trying again.`,
        };
      }
    }

    // Check progressive delays
    if (record.failures >= 5) {
      const cooldownMs = 60000; // 60 seconds cooldown
      if (now - record.lastFailureTime < cooldownMs) {
        const remainingMs = cooldownMs - (now - record.lastFailureTime);
        const remainingSec = Math.ceil(remainingMs / 1000);
        return {
          allowed: false,
          lockoutRemainingMs: remainingMs,
          consecutiveFailures: record.failures,
          reason: `Too many failed attempts. Please wait ${remainingSec} second(s) before trying again.`,
        };
      }
    } else if (record.failures >= 3) {
      const backoffMs = 5000; // 5 seconds delay
      if (now - record.lastFailureTime < backoffMs) {
        const remainingMs = backoffMs - (now - record.lastFailureTime);
        const remainingSec = Math.ceil(remainingMs / 1000);
        return {
          allowed: false,
          lockoutRemainingMs: remainingMs,
          consecutiveFailures: record.failures,
          reason: `Consecutive failed attempts. Please wait ${remainingSec} second(s).`,
        };
      }
    }

    return { allowed: true, consecutiveFailures: record.failures };
  }

  /**
   * Records a failed login attempt and applies progressive lockouts.
   */
  static recordFailure(identifier: string): { locked: boolean; failures: number; lockDurationMs?: number } {
    const key = identifier.toLowerCase().trim();
    const now = Date.now();
    const record = this.attempts.get(key) || { failures: 0, lastFailureTime: now };

    record.failures += 1;
    record.lastFailureTime = now;

    let locked = false;
    let lockDurationMs: number | undefined;

    if (record.failures >= 10) {
      // 15-minute lockout
      lockDurationMs = 15 * 60 * 1000;
      record.lockedUntil = now + lockDurationMs;
      locked = true;
    } else if (record.failures >= 5) {
      // 60-second cooldown
      lockDurationMs = 60 * 1000;
      record.lockedUntil = now + lockDurationMs;
      locked = true;
    }

    this.attempts.set(key, record);
    return { locked, failures: record.failures, lockDurationMs };
  }

  /**
   * Resets failure counter upon successful authentication or admin intervention.
   */
  static reset(identifier: string): void {
    const key = identifier.toLowerCase().trim();
    this.attempts.delete(key);
  }

  /**
   * Clears all rate limiter state (useful for test isolation).
   */
  static clearAll(): void {
    this.attempts.clear();
  }
}

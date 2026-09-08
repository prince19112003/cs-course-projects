import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../../src/main/services/RateLimiter.js';

describe('RateLimiter & Brute-Force Defense', () => {
  const testId = 'operator@test.local';

  beforeEach(() => {
    RateLimiter.clearAll();
  });

  it('allows normal login attempts under thresholds', () => {
    const status = RateLimiter.checkRateLimit(testId);
    expect(status.allowed).toBe(true);
    expect(status.consecutiveFailures).toBe(0);
  });

  it('enforces progressive backoff after 3 failed attempts', () => {
    RateLimiter.recordFailure(testId);
    RateLimiter.recordFailure(testId);
    const fail3 = RateLimiter.recordFailure(testId);

    expect(fail3.failures).toBe(3);

    const check = RateLimiter.checkRateLimit(testId);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Consecutive failed attempts');
  });

  it('enforces 60-second cooldown after 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      RateLimiter.recordFailure(testId);
    }

    const check = RateLimiter.checkRateLimit(testId);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Too many failed attempts');
  });

  it('enforces 15-minute lockout after 10 failed attempts', () => {
    for (let i = 0; i < 10; i++) {
      RateLimiter.recordFailure(testId);
    }

    const check = RateLimiter.checkRateLimit(testId);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Account locked due to consecutive failed attempts');
  });

  it('resets failure count upon explicit reset', () => {
    for (let i = 0; i < 6; i++) {
      RateLimiter.recordFailure(testId);
    }
    expect(RateLimiter.checkRateLimit(testId).allowed).toBe(false);

    RateLimiter.reset(testId);
    expect(RateLimiter.checkRateLimit(testId).allowed).toBe(true);
  });
});

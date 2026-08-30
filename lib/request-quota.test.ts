import { describe, expect, it } from 'vitest';
import { consumeRequestQuota } from './request-quota';

describe('consumeRequestQuota', () => {
  const config = { limit: 2, windowMs: 1_000 };

  it('limits one owner and feature independently', () => {
    expect(consumeRequestQuota('meal_analysis', 'quota-user-a', config, 0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(consumeRequestQuota('meal_analysis', 'quota-user-a', config, 10)).toMatchObject({ allowed: true, remaining: 0 });
    expect(consumeRequestQuota('meal_analysis', 'quota-user-a', config, 20)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(consumeRequestQuota('meal_analysis', 'quota-user-b', config, 20)).toMatchObject({ allowed: true, remaining: 1 });
  });

  it('allows a request once the oldest entry leaves the window', () => {
    expect(consumeRequestQuota('meal_analysis', 'quota-user-c', config, 0).allowed).toBe(true);
    expect(consumeRequestQuota('meal_analysis', 'quota-user-c', config, 10).allowed).toBe(true);
    expect(consumeRequestQuota('meal_analysis', 'quota-user-c', config, 1_011)).toMatchObject({ allowed: true, remaining: 1 });
  });
});

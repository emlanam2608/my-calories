type QuotaConfig = { limit: number; windowMs: number };
type QuotaResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

const buckets = new Map<string, number[]>();

export function consumeRequestQuota(
  feature: string,
  ownerId: string,
  config: QuotaConfig,
  now = Date.now(),
): QuotaResult {
  const key = `${feature}:${ownerId}`;
  const windowStart = now - config.windowMs;
  const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
  if (recent.length >= config.limit) {
    buckets.set(key, recent);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + config.windowMs - now) / 1_000)),
    };
  }

  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 500) pruneExpiredBuckets(now);
  return { allowed: true, remaining: config.limit - recent.length, retryAfterSeconds: 0 };
}

function pruneExpiredBuckets(now: number) {
  for (const [key, timestamps] of buckets) {
    const recent = timestamps.filter((timestamp) => timestamp > now - 3_600_000);
    if (recent.length) buckets.set(key, recent);
    else buckets.delete(key);
  }
}

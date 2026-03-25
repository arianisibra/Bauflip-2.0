const memoryStore = new Map<string, { count: number; expiresAt: number }>();

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  memoryStore.set(key, entry);

  return { allowed: true, remaining: Math.max(0, limit - entry.count) };
}

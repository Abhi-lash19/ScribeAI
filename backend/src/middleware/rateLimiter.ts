// backend/src/middleware/rateLimiter.ts

const lastMessageMap = new Map<string, number>();

const MIN_INTERVAL_MS = 3000; // 1 AI reply per 3 seconds per channel

export function isRateLimited(channelId: string): boolean {
  const now = Date.now();
  const last = lastMessageMap.get(channelId) || 0;

  if (now - last < MIN_INTERVAL_MS) {
    return true;
  }

  lastMessageMap.set(channelId, now);
  return false;
}

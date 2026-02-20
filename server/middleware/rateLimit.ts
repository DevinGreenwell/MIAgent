/** Simple in-memory sliding-window rate limiter for Hono. */
import type { Context, Next } from "hono";

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 300_000).unref();

/**
 * Creates rate-limiting middleware.
 * @param maxRequests Maximum requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const key = c.req.header("x-forwarded-for") || "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= maxRequests) {
      const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }

    entry.timestamps.push(now);
    return next();
  };
}

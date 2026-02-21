/** API key authentication middleware for Hono. */
import { timingSafeEqual } from "crypto";
import type { Context, Next } from "hono";

const API_SECRET = process.env.API_SECRET;

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Bearer token auth middleware.
 * If API_SECRET is set, all requests must include `Authorization: Bearer <secret>`.
 * If API_SECRET is not set, auth is disabled (development mode).
 */
export async function requireAuth(c: Context, next: Next) {
  if (!API_SECRET) {
    return next();
  }

  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const token = header.slice(7);
  if (!safeEqual(token, API_SECRET)) {
    return c.json({ error: "Invalid credentials" }, 403);
  }

  return next();
}

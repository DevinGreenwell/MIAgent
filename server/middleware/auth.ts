/** API key authentication middleware for Hono. */
import type { Context, Next } from "hono";

const API_SECRET = process.env.API_SECRET;

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
  if (token !== API_SECRET) {
    return c.json({ error: "Invalid credentials" }, 403);
  }

  return next();
}

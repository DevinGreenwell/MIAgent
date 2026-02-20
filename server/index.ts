/** MIAgent server — Hono app with API routes and static file serving. */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { requireAuth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import documentRoutes from "./routes/documents.js";
import componentRoutes from "./routes/components.js";
import chatRoutes from "./routes/chat.js";
import studyRoutes from "./routes/study.js";

const app = new Hono();

// Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.use("*", secureHeaders());

// CORS — restrict to allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use("*", cors({
  origin: allowedOrigins,
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  maxAge: 86400,
}));

// Auth on all API routes (disabled if API_SECRET is not set)
app.use("/api/*", requireAuth);

// Rate limiting on AI-powered endpoints (10 requests per minute per IP)
app.use("/api/v1/chat", rateLimit(10, 60_000));
app.use("/api/v1/study/generate", rateLimit(10, 60_000));

// API routes under /api/v1
app.route("/api/v1", documentRoutes);
app.route("/api/v1", componentRoutes);
app.route("/api/v1", chatRoutes);
app.route("/api/v1", studyRoutes);

// Serve static client files
app.use("/*", serveStatic({ root: "./client/dist" }));

// SPA fallback — serve index.html for all non-API, non-asset routes
app.get("*", (c) => {
  const path = c.req.path;
  // Don't serve SPA for API routes or file extensions
  if (path.startsWith("/api") || path.match(/\.\w+$/)) {
    return c.notFound();
  }
  return serveStatic({ root: "./client/dist", path: "/index.html" })(c, async () => {});
});

const PORT = parseInt(process.env.PORT || "3000");

console.log(`MIAgent server starting on http://localhost:${PORT}`);

serve({
  fetch: app.fetch,
  port: PORT,
});

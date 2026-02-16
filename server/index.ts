/** MIAgent server — Hono app with API routes and static file serving. */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import documentRoutes from "./routes/documents.js";
import componentRoutes from "./routes/components.js";
import chatRoutes from "./routes/chat.js";

const app = new Hono();

// CORS for development
app.use("*", cors());

// API routes under /api/v1
app.route("/api/v1", documentRoutes);
app.route("/api/v1", componentRoutes);
app.route("/api/v1", chatRoutes);

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

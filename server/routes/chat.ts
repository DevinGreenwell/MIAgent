/** Chat routes — AI-powered chat with hybrid RAG context (vector + FTS). */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import { anthropic, AI_MODEL } from "../lib/anthropic.js";
import { gatherRagContext, type RagSource } from "../lib/ragContext.js";

const app = new Hono();

const SYSTEM_PROMPT = `You are MIAgent — a seasoned, approachable Officer in Charge of Marine Inspection (OCMI) with decades of field experience. You've seen it all, and you genuinely enjoy helping newer inspectors find their footing.

## Your Personality
You're the OCMI that everyone wishes they had as a mentor — the one who pulls you aside on the dock and says "here's what I'd actually be looking at." You explain the *why* behind the regulation, not just the citation. You share the kind of practical wisdom that only comes from years of climbing into engine rooms and walking weather decks.

- **Talk like a person, not a manual.** You're having a conversation with a colleague, not writing a report. Use natural language. It's okay to say "honestly" or "the thing most people miss here is..."
- **Assume the user is still learning.** Don't talk down to them, but don't assume they know what you mean by shorthand references. When you cite a reg, briefly explain what it requires and why it matters in plain terms.
- **Share your thinking, not just your conclusion.** Explain how you'd approach a situation — what you'd look at first, what would concern you, what you'd want to rule out. Help them develop inspector instincts.
- **Be concise but warm.** Don't generate walls of checklists. A focused, well-explained answer beats an exhaustive one.

## Vessel Type Shorthand — NEVER GET THIS WRONG
When someone says "[X]-boat," the letter ALWAYS refers to the 46 CFR inspection subchapter. This is universal USCG shorthand:
- **T-boat** = Subchapter T = Small Passenger Vessel (under 100 GT)
- **K-boat** = Subchapter K = Small Passenger Vessel (100+ GT, aka the "big T-boats")
- **H-boat** = Subchapter H = Passenger Vessel (large, over 100 GT carrying more than 150 passengers or with overnight accommodations)
- **I-boat** = Subchapter I = Cargo and Miscellaneous Vessels
- **D-boat** = Subchapter D = Tank Vessels
- **L-boat** = Subchapter L = Offshore Supply Vessels
- **M-boat** = Subchapter M = Towing Vessels (Inspected Towing Vessels / ITVs)
- **U-boat** = Subchapter U = Oceanographic Vessels
- **R-boat** = Subchapter R = Nautical Schools

Other common abbreviations: SPV = Small Passenger Vessel, ITV = Inspected Towing Vessel, OSV = Offshore Supply Vessel.

Never ask "what do you mean by T-boat?" — you already know. Use this to immediately identify the correct regulatory subchapter.

## Before Answering — CRITICAL
A good OCMI asks the right questions first. If the user's scenario is missing key details (vessel type, route, tonnage, inspection type, what specifically concerns them, etc.), ask your clarifying questions and then STOP. Do NOT continue with a general answer — wait for them to reply. Frame your questions conversationally, like you would on the dock: "Before I point you in a direction — is this a COI renewal or more of an ad hoc look? And do you know roughly how old the vessel is?"

## Regulatory Citations
- When you reference a regulation, always cite it specifically (e.g., "per **46 CFR 56.50-105(a)**") and include the document_id from the database context when available so the UI can link to it.
- Weave citations naturally into your explanation rather than listing them separately. The citation supports the point — it shouldn't BE the point.
- Choose the right framework: international vessels → IMO conventions (SOLAS, MARPOL, STCW); domestic → 46 CFR / 33 CFR; when both apply, note which takes precedence.

## Deficiency Capture
When helping identify or write up a deficiency:
1. Name it clearly with the correct regulatory citation
2. Explain the severity (critical, serious, moderate, minor) and *why* it's at that level
3. Share what enforcement approach you'd recommend, with your reasoning
4. Suggest practical remediation steps with realistic timelines

## Formatting
Use markdown for readability — **bold** for key terms and reg references, bullet points where they help, headings for longer responses. But don't over-structure short answers. A conversational paragraph is often better than a bulleted list.`;

/** Enrich RAG context with optional 3D component data. */
function addComponentContext(
  ragContext: string,
  componentMesh: string | undefined,
): { ragContext: string; componentRefs: string[] } {
  if (!componentMesh) return { ragContext, componentRefs: [] };

  const comp = db.prepare(`
    SELECT c.display_name, c.description, c.inspection_notes, s.name as system_name
    FROM components c
    JOIN systems s ON s.id = c.system_id
    WHERE c.mesh_name = ?
  `).get(componentMesh) as {
    display_name: string;
    description: string;
    inspection_notes: string;
    system_name: string;
  } | undefined;

  if (!comp) return { ragContext, componentRefs: [] };

  ragContext += `\n\n--- Selected Component: ${comp.display_name} (${comp.system_name}) ---\n`;
  ragContext += `Description: ${comp.description}\n`;
  ragContext += `Inspection Notes: ${comp.inspection_notes}`;
  return { ragContext, componentRefs: [componentMesh] };
}

/** Build the Anthropic messages array from session history + RAG-enriched prompt. */
function buildMessages(sid: string, message: string, ragContext: string) {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Limit history to last 50 messages to prevent unbounded memory usage
  const history = db.prepare(
    "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 50"
  ).all(sid).reverse() as Array<{ role: string; content: string }>;

  for (const msg of history) {
    messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
  }

  const userPrompt = ragContext
    ? `Context from relevant USCG documents:\n${ragContext}\n\n---\n\nUser question: ${message}`
    : message;

  if (messages.length > 0) {
    messages[messages.length - 1] = { role: "user", content: userPrompt };
  }

  return messages;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /chat — streaming AI response with SSE
app.post("/chat", async (c) => {
  const body = await c.req.json();
  const { message, sessionId, componentContext } = body as {
    message: string;
    sessionId?: string;
    componentContext?: string;
  };

  if (!message?.trim()) {
    return c.json({ error: "Message is required" }, 400);
  }

  if (message.length > 10_000) {
    return c.json({ error: "Message must be under 10,000 characters" }, 400);
  }

  // Validate session ID format if provided
  if (sessionId && !UUID_RE.test(sessionId)) {
    return c.json({ error: "Invalid session ID format" }, 400);
  }

  // Get or create session
  const sid = sessionId || uuid();
  db.prepare(
    "INSERT OR IGNORE INTO chat_sessions (id, title) VALUES (?, ?)"
  ).run(sid, message.slice(0, 100));

  // Store user message
  db.prepare(
    "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)"
  ).run(sid, message);

  // Gather RAG context
  const { ragContext: rawContext, sources } = await gatherRagContext(message);
  const { ragContext, componentRefs } = addComponentContext(rawContext, componentContext);

  // If no AI client, return non-streaming fallback
  if (!anthropic) {
    const responseText = `**MIAgent Response** (AI service not configured)\n\nYour question about "${message.slice(0, 50)}..." has been received. To enable AI responses, set the \`ANTHROPIC_API_KEY\` environment variable.\n\n${
      sources.length > 0
        ? `I found ${sources.length} relevant documents that may help:\n${sources.map((s) => `- **${s.document_id}**: ${s.title}`).join("\n")}`
        : "No directly relevant documents found for this query."
    }`;

    db.prepare(
      "INSERT INTO chat_messages (session_id, role, content, sources) VALUES (?, 'assistant', ?, ?)"
    ).run(sid, responseText, JSON.stringify(sources));

    return c.json({ data: { message: responseText, sessionId: sid, sources, componentRefs } });
  }

  const messages = buildMessages(sid, message, ragContext);

  // Stream response via SSE
  return streamSSE(c, async (stream) => {
    // Send metadata first (sources, sessionId)
    await stream.writeSSE({
      event: "metadata",
      data: JSON.stringify({ sessionId: sid, sources, componentRefs }),
    });

    let fullText = "";

    try {
      const response = anthropic!.messages.stream({
        model: AI_MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages,
      });

      for await (const event of response) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const text = event.delta.text;
          fullText += text;
          await stream.writeSSE({ event: "text", data: JSON.stringify(text) });
        }
      }
    } catch (err) {
      console.error("Anthropic API error:", err);
      fullText = "I encountered an error processing your request. Please try again.";
      await stream.writeSSE({ event: "text", data: JSON.stringify(fullText) });
    }

    // Persist the completed response
    db.prepare(
      "INSERT INTO chat_messages (session_id, role, content, sources) VALUES (?, 'assistant', ?, ?)"
    ).run(sid, fullText, JSON.stringify(sources));

    db.prepare(
      "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?"
    ).run(sid);

    await stream.writeSSE({ event: "done", data: "" });
  });
});

// GET /chat/sessions
app.get("/chat/sessions", (c) => {
  const rows = db.prepare(`
    SELECT cs.id, cs.title, cs.created_at,
           (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) as message_count
    FROM chat_sessions cs
    ORDER BY cs.updated_at DESC
    LIMIT 50
  `).all();

  return c.json({ data: rows });
});

// GET /chat/sessions/:id
app.get("/chat/sessions/:id", (c) => {
  const id = c.req.param("id");

  const session = db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const messages = db.prepare(
    "SELECT role, content, sources, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at"
  ).all(id);

  return c.json({ data: { ...session, messages } });
});

// DELETE /chat/sessions/:id
app.delete("/chat/sessions/:id", (c) => {
  const id = c.req.param("id");
  db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
  return c.json({ data: { deleted: true } });
});

export default app;

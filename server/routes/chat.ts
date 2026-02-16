/** Chat routes — AI-powered chat with RAG context. */
import { Hono } from "hono";
import Groq from "groq-sdk";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const app = new Hono();

// Initialize Groq client (requires GROQ_API_KEY env var)
let groq: Groq | null = null;
try {
  groq = new Groq();
} catch {
  console.warn("GROQ_API_KEY not set — chat will return placeholder responses");
}

const SYSTEM_PROMPT = `You are MIAgent — the most knowledgeable, experienced, and trusted Officer in Charge of Marine Inspection (OCMI) in the United States Coast Guard.

Your role is to help USCG Marine Inspectors by providing policy-backed, well-reasoned responses.

## Regulatory Framework Selection
When presented with a scenario or question, first identify the primary regulatory framework based on the vessel's route:
- **International vessels** → IMO conventions and regulations (SOLAS, MARPOL, STCW, etc.)
- **Domestic vessels** → Code of Federal Regulations (CFR), particularly 46 CFR and 33 CFR
- **Where both apply** → cite from both frameworks and note which takes precedence

## Response Requirements
- **Always cite the specific regulation, policy, or document** that supports your answer (e.g., "per 46 CFR 56.50-105(a)" or "SOLAS Ch. II-2, Reg. 10"). Include the document_id when referencing documents from the database so the UI can link to them.
- **Include ALL supporting references** — do not omit relevant citations for brevity.
- **Communicate conversationally** — friendly, professional, and approachable without being overly formal. Think experienced mentor, not bureaucrat.

## Before Answering
A good OCMI asks the right questions. If the scenario is ambiguous or you lack critical details (vessel type, route, tonnage, inspection type, etc.), ask clarifying questions before providing your answer. Do not guess when key facts are missing.

## Deficiency Capture
When assisting with deficiency identification:
1. Identify the deficiency with the correct regulatory citation
2. Assess severity (critical, serious, moderate, minor)
3. Recommend the most appropriate level of enforcement, applying OCMI-level judgement
4. Suggest remediation steps with realistic timelines

## Formatting
Use markdown: **bold** for key regulatory references, bullet points for lists, and headings (##) to organize longer responses. Keep responses thorough but scannable.`;

// POST /chat — send message, get AI response with RAG context
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

  // Get or create session
  const sid = sessionId || uuid();
  db.prepare(
    "INSERT OR IGNORE INTO chat_sessions (id, title) VALUES (?, ?)"
  ).run(sid, message.slice(0, 100));

  // Store user message
  db.prepare(
    "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)"
  ).run(sid, message);

  // Build context from relevant documents (simple FTS search)
  let ragContext = "";
  const sources: Array<{ id: number; document_id: string; title: string; collection_id: string }> = [];

  try {
    const searchTerms = message.split(/\s+/).slice(0, 5).map((w) => `"${w.replace(/"/g, "")}"`).join(" OR ");
    const relevantDocs = db.prepare(`
      SELECT d.id, d.document_id, d.title, d.collection_id, dt.content
      FROM documents d
      LEFT JOIN document_text dt ON dt.document_id = d.id
      JOIN documents_fts fts ON fts.rowid = d.id
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT 5
    `).all(searchTerms) as Array<{
      id: number;
      document_id: string;
      title: string;
      collection_id: string;
      content: string | null;
    }>;

    for (const doc of relevantDocs) {
      sources.push({
        id: doc.id,
        document_id: doc.document_id,
        title: doc.title,
        collection_id: doc.collection_id,
      });
      const snippet = doc.content ? doc.content.slice(0, 500) : "";
      ragContext += `\n\n--- Document: ${doc.document_id} (${doc.title}) ---\n${snippet}`;
    }
  } catch {
    // FTS search failed, continue without context
  }

  // Add component context if provided
  let componentRefs: string[] = [];
  if (componentContext) {
    const comp = db.prepare(`
      SELECT c.display_name, c.description, c.inspection_notes, s.name as system_name
      FROM components c
      JOIN systems s ON s.id = c.system_id
      WHERE c.mesh_name = ?
    `).get(componentContext) as {
      display_name: string;
      description: string;
      inspection_notes: string;
      system_name: string;
    } | undefined;

    if (comp) {
      ragContext += `\n\n--- Selected Component: ${comp.display_name} (${comp.system_name}) ---\n`;
      ragContext += `Description: ${comp.description}\n`;
      ragContext += `Inspection Notes: ${comp.inspection_notes}`;
      componentRefs = [componentContext];
    }
  }

  // Call Groq API or return placeholder
  let responseText: string;

  if (groq) {
    try {
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      // Load conversation history
      const history = db.prepare(
        "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at"
      ).all(sid) as Array<{ role: string; content: string }>;

      for (const msg of history) {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }

      const userPrompt = ragContext
        ? `Context from relevant USCG documents:\n${ragContext}\n\n---\n\nUser question: ${message}`
        : message;

      // Replace last user message with enriched version
      if (messages.length > 0) {
        messages[messages.length - 1] = { role: "user", content: userPrompt };
      }

      const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        max_tokens: 1024,
        messages,
      });

      responseText =
        response.choices[0]?.message?.content || "I could not generate a response.";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      responseText = `I encountered an error processing your request: ${msg}`;
    }
  } else {
    responseText = `**MIAgent Response** (AI service not configured)\n\nYour question about "${message.slice(0, 50)}..." has been received. To enable AI responses, set the \`GROQ_API_KEY\` environment variable.\n\n${
      sources.length > 0
        ? `I found ${sources.length} relevant documents that may help:\n${sources.map((s) => `- **${s.document_id}**: ${s.title}`).join("\n")}`
        : "No directly relevant documents found for this query."
    }`;
  }

  // Store assistant response
  db.prepare(
    "INSERT INTO chat_messages (session_id, role, content, sources) VALUES (?, 'assistant', ?, ?)"
  ).run(sid, responseText, JSON.stringify(sources));

  // Update session
  db.prepare(
    "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?"
  ).run(sid);

  return c.json({
    data: {
      message: responseText,
      sessionId: sid,
      sources,
      componentRefs,
    },
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

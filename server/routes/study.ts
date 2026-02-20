/** Study routes — AI-powered study material generation with RAG context. */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import db from "../db.js";
import { anthropic, AI_MODEL } from "../lib/anthropic.js";
import { gatherRagContext } from "../lib/ragContext.js";

const app = new Hono();

// ── Qualification definitions (server-side mirror) ──────────────────────

interface QualDef {
  id: string;
  label: string;
  fullName: string;
  subchapter?: string;
  vesselType?: string;
  cfrParts?: number[];
  collections: string[];
  studyContext: string;
}

const QUALS: QualDef[] = [
  // Domestic (alphabetical by id)
  {
    id: "BI", label: "Barge Inspector", fullName: "Barge Inspector",
    vesselType: "uninspected-vessels",
    cfrParts: [30, 31, 32, 33, 34, 35, 151, 153],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext: "Barge Inspector — Inspection of tank barges, deck barges, and other non-self-propelled vessels. Key areas: hull integrity, cargo containment, venting systems, pollution prevention, towing gear.",
  },
  {
    id: "DI", label: "Dry Dock Inspector", fullName: "Dry Dock Inspector",
    cfrParts: [61, 71, 91, 107, 115, 176],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext: "Dry Dock Inspector — Drydock and internal structural examinations across all vessel types. Key areas: hull plating, shell readings, sea valves, rudder/propeller, cathodic protection.",
  },
  {
    id: "HI", label: "Hull Inspector", fullName: "Hull Inspector",
    cfrParts: [42, 44, 45, 46, 56, 58, 61, 71, 91, 115, 176],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "class-rules"],
    studyContext: "Hull Inspector — Hull structural inspections across all vessel types. Key areas: structural members, watertight integrity, stability, hull openings, load line compliance, structural fire protection.",
  },
  {
    id: "HT", label: "Hull Tank Inspector", fullName: "Hull Tank Inspector",
    vesselType: "tank-vessels",
    cfrParts: [30, 31, 32, 33, 34, 35, 39, 40, 151, 153],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext: "Hull Tank Inspector — Combined hull and cargo tank inspections for tank vessels and tank barges. Key areas: cargo tank integrity, coatings, venting, cargo piping, OPA 90, double hull requirements, inert gas.",
  },
  {
    id: "KI", label: "K Inspector", fullName: "Small Passenger Vessels ≥100 GT (Subchapter K)",
    subchapter: "K", vesselType: "small-passenger-vessels",
    cfrParts: [114, 115, 116, 117, 118, 119, 120, 121, 122],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext: "Subchapter K — Small Passenger Vessels of 100 GT and above. Key areas: structural fire protection, means of escape, stability, lifesaving equipment.",
  },
  {
    id: "MI", label: "Machinery Inspector", fullName: "Machinery Inspector",
    cfrParts: [50, 52, 54, 56, 58, 62, 63],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext: "Machinery Inspector — Main propulsion, auxiliary machinery, and related systems. Key areas: diesel/gas turbine engines, reduction gears, shafting, fuel oil, bilge/ballast, steering gear, electrical, automation.",
  },
  {
    id: "MODU", label: "MODU Inspector", fullName: "Mobile Offshore Drilling Unit Inspector",
    subchapter: "IA", vesselType: "mobile-offshore-drilling-units",
    cfrParts: [107, 108, 109],
    collections: ["cfr", "nvic", "prg", "mtn", "class-rules"],
    studyContext: "Subchapter IA — Mobile Offshore Drilling Units (MODUs). Key areas: structural integrity, stability, marine evacuation systems, firefighting, industrial systems, classification society oversight.",
  },
  {
    id: "MS", label: "Machinery Steam Inspector", fullName: "Machinery Steam Inspector",
    cfrParts: [50, 52, 54, 56, 58, 62, 63],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext: "Machinery Steam Inspector — Steam propulsion plants and high-pressure boiler systems. Key areas: boiler construction/testing (46 CFR 52–54), steam piping, pressure vessels, safety valves, superheaters, steam turbines.",
  },
  {
    id: "OSV", label: "OSV Inspector", fullName: "Offshore Supply Vessel Inspector",
    subchapter: "L", vesselType: "offshore-supply-vessels",
    cfrParts: [125, 126, 127, 128, 129, 130, 131, 132, 133, 134],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext: "Subchapter L — Offshore Supply Vessels (OSVs). Key areas: deck cargo, stability with cargo, fire protection, lifesaving, machinery, dynamic positioning.",
  },
  {
    id: "TI", label: "T Inspector", fullName: "Small Passenger Vessels (Subchapter T)",
    subchapter: "T", vesselType: "small-passenger-vessels",
    cfrParts: [175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext: "Subchapter T — Small Passenger Vessels under 100 GT. Key areas: hull structure, stability, fire protection, lifesaving, machinery, electrical systems.",
  },
  // Foreign (alphabetical by id)
  {
    id: "FCVE", label: "Foreign Chemical Vessel Examiner", fullName: "Foreign Chemical Vessel Examiner",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext: "Foreign Chemical Vessel Examiner — Foreign-flag chemical tankers, SOLAS, MARPOL Annex II, IBC Code. Key areas: cargo containment, tank coatings, venting, gas detection, pollution prevention.",
  },
  {
    id: "FFVE", label: "Foreign Freight Vessel Examiner", fullName: "Foreign Freight Vessel Examiner",
    vesselType: "cargo-miscellaneous-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext: "Foreign Freight Vessel Examiner — Foreign-flag freight/cargo vessels, SOLAS, MARPOL, Load Line conventions. Key areas: structural safety, fire protection, lifesaving, cargo securing, ISM/ISPS, STCW.",
  },
  {
    id: "FFTE", label: "Foreign Tank Vessel Examiner", fullName: "Foreign Tank Vessel Examiner",
    vesselType: "tank-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext: "Foreign Tank Vessel Examiner — Foreign-flag oil tankers, SOLAS, MARPOL Annex I. Key areas: cargo tank integrity, inert gas, crude oil washing, oil discharge monitoring, double hull, ISM/ISPS.",
  },
  {
    id: "FGVE", label: "Foreign Gas Vessel Examiner", fullName: "Foreign Gas Vessel Examiner",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext: "Foreign Gas Vessel Examiner — Foreign-flag gas carriers (LNG/LPG), SOLAS, MARPOL, IGC Code. Key areas: cargo containment, pressure relief, gas detection, emergency shutdown, re-liquefaction.",
  },
  {
    id: "FPVE", label: "Foreign Passenger Vessel Examiner", fullName: "Foreign Passenger Vessel Examiner",
    vesselType: "passenger-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext: "Foreign Passenger Vessel Examiner — Foreign-flag passenger vessels/cruise ships, SOLAS, MARPOL, MLC. Key areas: structural fire protection, means of escape, lifesaving, stability, ISM/ISPS, Safe Return to Port.",
  },
  {
    id: "PSCE", label: "Port State Control Examiner", fullName: "Port State Control Examiner",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext: "Port State Control Examiner — General examination of foreign-flag vessels, SOLAS, MARPOL, STCW, MLC. Key areas: ISM/ISPS compliance, structural safety, fire protection, lifesaving, pollution prevention, detention criteria.",
  },
];

const QUAL_MAP = new Map(QUALS.map((q) => [q.id, q]));

// ── Content type prompt templates ───────────────────────────────────────

type ContentType = "flashcards" | "quiz" | "scenario" | "slideshow";

function getContentPrompt(type: ContentType, qual: QualDef, topic: string | undefined): string {
  const topicClause = topic ? ` Focus specifically on: ${topic}.` : "";
  const base = `You are generating study materials for a USCG Marine Inspector preparing for their ${qual.label} qualification (${qual.fullName}). ${qual.studyContext}${topicClause}

Use ONLY the provided reference document context below to generate content. Every item must be grounded in a specific regulation or guidance document. If the context doesn't contain enough information, generate what you can and note any gaps.`;

  switch (type) {
    case "flashcards":
      return `${base}

Generate 10-15 flashcards as a JSON array. Each flashcard tests one key concept, regulation, or inspection requirement.

Return ONLY valid JSON in this exact format:
[{"front":"Question or term","back":"Answer with specific regulation citation","citation":"46 CFR XX.XX-XX"}]`;

    case "quiz":
      return `${base}

Generate 8-10 multiple choice quiz questions as a JSON array. Each question should test practical inspection knowledge.

Return ONLY valid JSON in this exact format:
[{"question":"Question text","options":["A","B","C","D"],"answer":0,"explanation":"Why this is correct with regulation reference","citation":"46 CFR XX.XX-XX"}]

The "answer" field is the zero-based index of the correct option.`;

    case "scenario":
      return `${base}

Generate 3-4 realistic board examination scenarios as a JSON array. Each scenario presents a situation an inspector might encounter.

Return ONLY valid JSON in this exact format:
[{"title":"Scenario title","situation":"Detailed scenario description","expectedActions":["Action 1","Action 2","Action 3"],"keyRegs":["46 CFR XX.XX-XX","NVIC XX-XX"]}]`;

    case "slideshow":
      return `${base}

Generate 6-8 presentation slides as a JSON array covering key topics for this qualification.

Return ONLY valid JSON in this exact format:
[{"title":"Slide title","bullets":["Key point 1","Key point 2","Key point 3"],"speakerNotes":"Detailed notes for the presenter","citations":["46 CFR XX.XX-XX"]}]`;
  }
}

// ── GET /study/references?qualId=TI ─────────────────────────────────────

app.get("/study/references", (c) => {
  const qualId = c.req.query("qualId");
  if (!qualId) return c.json({ error: "qualId is required" }, 400);

  const qual = QUAL_MAP.get(qualId);
  if (!qual) return c.json({ error: "Unknown qualification" }, 404);

  // Build query to find documents matching this qualification
  const collPlaceholders = qual.collections.map(() => "?").join(",");
  const params: (string | number)[] = [...qual.collections];

  let query = `
    SELECT DISTINCT d.id, d.document_id, d.title, d.collection_id, d.year, d.summary
    FROM documents d
    WHERE d.collection_id IN (${collPlaceholders})
  `;

  // Filter by vessel type if available
  if (qual.vesselType) {
    query += `
      AND (
        d.id IN (
          SELECT dvt.document_id FROM document_vessel_types dvt
          JOIN vessel_types vt ON vt.id = dvt.vessel_type_id
          WHERE vt.slug = ?
        )
        OR d.collection_id = 'cfr'
      )
    `;
    params.push(qual.vesselType);
  }

  // Filter CFR by part numbers if available
  if (qual.cfrParts && qual.cfrParts.length > 0) {
    const partPatterns = qual.cfrParts.map(() => "d.document_id LIKE ?").join(" OR ");
    query += ` AND (d.collection_id != 'cfr' OR (${partPatterns}))`;
    for (const part of qual.cfrParts) {
      params.push(`cfr/%-Part-${part}%`);
    }
  }

  query += " ORDER BY d.collection_id, d.document_id LIMIT 100";

  const rows = db.prepare(query).all(...params) as Array<{
    id: number; document_id: string; title: string; collection_id: string; year: number | null; summary: string | null;
  }>;

  return c.json({ data: rows });
});

// ── POST /study/generate (streaming SSE) ────────────────────────────────

app.post("/study/generate", async (c) => {
  const body = await c.req.json();
  const { qualId, contentType, topic, documentIds } = body as {
    qualId: string;
    contentType: ContentType;
    topic?: string;
    documentIds?: string[];
  };
  const hasDocFilter = Array.isArray(documentIds) && documentIds.length > 0;

  if (!qualId || !contentType) {
    return c.json({ error: "qualId and contentType are required" }, 400);
  }

  if (!/^[A-Z]{2,5}$/.test(qualId)) {
    return c.json({ error: "Invalid qualId format" }, 400);
  }

  if (topic && topic.length > 200) {
    return c.json({ error: "Topic must be under 200 characters" }, 400);
  }

  if (Array.isArray(documentIds) && documentIds.length > 50) {
    return c.json({ error: "Too many document IDs (max 50)" }, 400);
  }

  const qual = QUAL_MAP.get(qualId);
  if (!qual) return c.json({ error: "Unknown qualification" }, 404);

  const validTypes: ContentType[] = ["flashcards", "quiz", "scenario", "slideshow"];
  if (!validTypes.includes(contentType)) {
    return c.json({ error: "Invalid contentType" }, 400);
  }

  // Check cache (7-day TTL) — skip when document filter is active (filtered results aren't globally cacheable)
  const cacheKey = topic || "";
  if (!hasDocFilter) {
    const cached = db.prepare(`
      SELECT id, content, created_at FROM study_content
      WHERE qual_id = ? AND content_type = ? AND topic = ?
        AND created_at > datetime('now', '-7 days')
    `).get(qualId, contentType, cacheKey) as { id: number; content: string; created_at: string } | undefined;

    if (cached) {
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          event: "metadata",
          data: JSON.stringify({ qualId, contentType, cached: true }),
        });
        await stream.writeSSE({ event: "text", data: cached.content });
        await stream.writeSSE({ event: "done", data: JSON.stringify({ id: cached.id }) });
      });
    }
  }

  if (!anthropic) {
    return c.json({
      error: "AI service not configured. Set ANTHROPIC_API_KEY environment variable.",
    }, 503);
  }

  // Gather RAG context scoped to qualification
  const queryText = `${qual.fullName} ${qual.studyContext} ${contentType} ${topic || ""}`.trim();
  const { ragContext, sources } = await gatherRagContext(queryText, {
    tokenBudget: 6000,
    vectorLimit: 15,
    ftsLimit: 5,
    collections: qual.collections,
    documentIdFilter: hasDocFilter ? new Set(documentIds) : undefined,
    minWordLength: 3,
    maxSearchTerms: 6,
  });

  const systemPrompt = getContentPrompt(contentType, qual, topic);
  const userMessage = ragContext
    ? `Here are the relevant reference documents:\n${ragContext}\n\n---\n\nGenerate the ${contentType} based on the above context.`
    : `Generate ${contentType} for the ${qual.fullName} qualification using your knowledge of USCG regulations.`;

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "metadata",
      data: JSON.stringify({ qualId, contentType, sources }),
    });

    let fullText = "";

    try {
      const response = anthropic!.messages.stream({
        model: AI_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
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
      fullText = JSON.stringify([{ error: "Generation failed. Please try again." }]);
      await stream.writeSSE({ event: "text", data: JSON.stringify(fullText) });
    }

    // Cache the result (skip when document filter is active)
    let savedId: number | null = null;
    if (!hasDocFilter) {
      try {
        const result = db.prepare(`
          INSERT OR REPLACE INTO study_content (qual_id, content_type, topic, content)
          VALUES (?, ?, ?, ?)
        `).run(qualId, contentType, cacheKey, fullText);
        savedId = result.lastInsertRowid as number;
      } catch (err) {
        console.warn("Study content cache write failed:", err);
      }
    }

    await stream.writeSSE({ event: "done", data: JSON.stringify({ id: savedId }) });
  });
});

// ── GET /study/history — list all generated study content (metadata only) ─────

app.get("/study/history", (c) => {
  const rows = db.prepare(`
    SELECT id, qual_id, content_type, topic, created_at
    FROM study_content
    ORDER BY created_at DESC
    LIMIT 200
  `).all() as Array<{
    id: number; qual_id: string; content_type: string; topic: string | null; created_at: string;
  }>;

  return c.json({ data: rows });
});

// ── GET /study/history/:id — fetch full content for a history item ───────────

app.get("/study/history/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);

  const row = db.prepare(`
    SELECT id, qual_id, content_type, topic, content, created_at
    FROM study_content WHERE id = ?
  `).get(id) as {
    id: number; qual_id: string; content_type: string; topic: string | null; content: string; created_at: string;
  } | undefined;

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

// ── DELETE /study/history/:id — remove a history item ────────────────────────

app.delete("/study/history/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);

  db.prepare(`DELETE FROM study_content WHERE id = ?`).run(id);
  return c.body(null, 204);
});

export default app;

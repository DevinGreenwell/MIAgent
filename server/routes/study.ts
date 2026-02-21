/** Study routes — AI-powered study material generation with RAG context. */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../db.js";
import { anthropic, AI_MODEL } from "../lib/anthropic.js";
import { genai, IMAGE_MODEL } from "../lib/gemini-image.js";
import { gatherRagContext } from "../lib/ragContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, "..", "..", "data", "slideshow-images");

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
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Barge Inspector — Inspection of tank barges, deck barges, and other non-self-propelled vessels. Key areas: hull integrity, cargo containment, venting systems, pollution prevention, towing gear.",
  },
  {
    id: "DI", label: "Dry Dock Inspector", fullName: "Dry Dock Inspector",
    cfrParts: [61, 71, 91, 107, 115, 176],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "class-rules", "msm"],
    studyContext: "Dry Dock Inspector — Drydock and internal structural examinations across all vessel types. Key areas: hull plating, shell readings, sea valves, rudder/propeller, cathodic protection.",
  },
  {
    id: "HI", label: "Hull Inspector", fullName: "Hull Inspector",
    cfrParts: [42, 44, 45, 46, 56, 58, 61, 71, 91, 115, 176],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "class-rules", "msm"],
    studyContext: "Hull Inspector — Hull structural inspections across all vessel types. Key areas: structural members, watertight integrity, stability, hull openings, load line compliance, structural fire protection.",
  },
  {
    id: "HT", label: "Hull Tank Inspector", fullName: "Hull Tank Inspector",
    vesselType: "tank-vessels",
    cfrParts: [30, 31, 32, 33, 34, 35, 39, 40, 151, 153],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Hull Tank Inspector — Combined hull and cargo tank inspections for tank vessels and tank barges. Key areas: cargo tank integrity, coatings, venting, cargo piping, OPA 90, double hull requirements, inert gas.",
  },
  {
    id: "KI", label: "K Inspector", fullName: "Small Passenger Vessels ≥100 GT (Subchapter K)",
    subchapter: "K", vesselType: "small-passenger-vessels",
    cfrParts: [114, 115, 116, 117, 118, 119, 120, 121, 122],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Subchapter K — Small Passenger Vessels of 100 GT and above. Key areas: structural fire protection, means of escape, stability, lifesaving equipment.",
  },
  {
    id: "MI", label: "Machinery Inspector", fullName: "Machinery Inspector",
    cfrParts: [50, 52, 54, 56, 58, 62, 63],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Machinery Inspector — Main propulsion, auxiliary machinery, and related systems. Key areas: diesel/gas turbine engines, reduction gears, shafting, fuel oil, bilge/ballast, steering gear, electrical, automation.",
  },
  {
    id: "MODU", label: "MODU Inspector", fullName: "Mobile Offshore Drilling Unit Inspector",
    subchapter: "IA", vesselType: "mobile-offshore-drilling-units",
    cfrParts: [107, 108, 109],
    collections: ["cfr", "nvic", "prg", "mtn", "class-rules", "msm"],
    studyContext: "Subchapter IA — Mobile Offshore Drilling Units (MODUs). Key areas: structural integrity, stability, marine evacuation systems, firefighting, industrial systems, classification society oversight.",
  },
  {
    id: "MS", label: "Machinery Steam Inspector", fullName: "Machinery Steam Inspector",
    cfrParts: [50, 52, 54, 56, 58, 62, 63],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Machinery Steam Inspector — Steam propulsion plants and high-pressure boiler systems. Key areas: boiler construction/testing (46 CFR 52–54), steam piping, pressure vessels, safety valves, superheaters, steam turbines.",
  },
  {
    id: "OSV", label: "OSV Inspector", fullName: "Offshore Supply Vessel Inspector",
    subchapter: "L", vesselType: "offshore-supply-vessels",
    cfrParts: [125, 126, 127, 128, 129, 130, 131, 132, 133, 134],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Subchapter L — Offshore Supply Vessels (OSVs). Key areas: deck cargo, stability with cargo, fire protection, lifesaving, machinery, dynamic positioning.",
  },
  {
    id: "TI", label: "T Inspector", fullName: "Small Passenger Vessels (Subchapter T)",
    subchapter: "T", vesselType: "small-passenger-vessels",
    cfrParts: [175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Subchapter T — Small Passenger Vessels under 100 GT. Key areas: hull structure, stability, fire protection, lifesaving, machinery, electrical systems.",
  },
  // Foreign (alphabetical by id)
  {
    id: "FCVE", label: "Foreign Chemical Vessel Examiner", fullName: "Foreign Chemical Vessel Examiner",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Foreign Chemical Vessel Examiner — Foreign-flag chemical tankers, SOLAS, MARPOL Annex II, IBC Code. Key areas: cargo containment, tank coatings, venting, gas detection, pollution prevention.",
  },
  {
    id: "FFVE", label: "Foreign Freight Vessel Examiner", fullName: "Foreign Freight Vessel Examiner",
    vesselType: "cargo-miscellaneous-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Foreign Freight Vessel Examiner — Foreign-flag freight/cargo vessels, SOLAS, MARPOL, Load Line conventions. Key areas: structural safety, fire protection, lifesaving, cargo securing, ISM/ISPS, STCW.",
  },
  {
    id: "FFTE", label: "Foreign Tank Vessel Examiner", fullName: "Foreign Tank Vessel Examiner",
    vesselType: "tank-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Foreign Tank Vessel Examiner — Foreign-flag oil tankers, SOLAS, MARPOL Annex I. Key areas: cargo tank integrity, inert gas, crude oil washing, oil discharge monitoring, double hull, ISM/ISPS.",
  },
  {
    id: "FGVE", label: "Foreign Gas Vessel Examiner", fullName: "Foreign Gas Vessel Examiner",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Foreign Gas Vessel Examiner — Foreign-flag gas carriers (LNG/LPG), SOLAS, MARPOL, IGC Code. Key areas: cargo containment, pressure relief, gas detection, emergency shutdown, re-liquefaction.",
  },
  {
    id: "FPVE", label: "Foreign Passenger Vessel Examiner", fullName: "Foreign Passenger Vessel Examiner",
    vesselType: "passenger-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter", "msm"],
    studyContext: "Foreign Passenger Vessel Examiner — Foreign-flag passenger vessels/cruise ships, SOLAS, MARPOL, MLC. Key areas: structural fire protection, means of escape, lifesaving, stability, ISM/ISPS, Safe Return to Port.",
  },
  {
    id: "PSCE", label: "Port State Control Examiner", fullName: "Port State Control Examiner",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter", "msm"],
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

  query += " ORDER BY d.collection_id, d.document_id LIMIT 250";

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

// ── Slideshow image generation helpers ──────────────────────────────────────

const IMAGE_PROMPT_SYSTEM = `You are a presentation slide designer. Given a slide's title and key points about USCG maritime inspection topics, create an image generation prompt for a COMPLETE VISUAL PRESENTATION SLIDE — the entire slide rendered as one image.

Requirements for the slide image:
- Dark navy/charcoal background (#1a1a2e or similar deep dark tone)
- Title in LARGE bold white text prominently at the top of the slide
- 3-5 short bullet points in clean white text below the title, clearly readable
- Subtle maritime accent imagery as a watermark or background element (anchor, compass rose, ship silhouette, waves) — translucent, not competing with text
- Professional corporate presentation aesthetic, widescreen 16:9 layout
- Clean modern typography, generous spacing between bullets
- The text content MUST be included EXACTLY as provided — this is critical
- NO detailed human faces
- Under 300 words

Return ONLY the image prompt text, nothing else.`;

/** Truncate bullets for legibility in generated slide images. */
function truncateBullets(bullets: string[], maxBullets = 5, maxWords = 8): string[] {
  return bullets.slice(0, maxBullets).map((b) => {
    const words = b.split(/\s+/);
    return words.length > maxWords ? words.slice(0, maxWords).join(" ") + "..." : b;
  });
}

async function generateImagePrompt(
  slideTitle: string,
  bullets: string[],
): Promise<string> {
  const shortBullets = truncateBullets(bullets);
  if (!anthropic) {
    return fallbackImagePrompt(slideTitle, shortBullets);
  }
  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      system: IMAGE_PROMPT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Create a complete slide image prompt for:\nTitle: ${slideTitle}\nKey Points:\n${shortBullets.map((b) => `- ${b}`).join("\n")}`,
        },
      ],
    });
    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    return text.trim() || fallbackImagePrompt(slideTitle, shortBullets);
  } catch {
    return fallbackImagePrompt(slideTitle, shortBullets);
  }
}

function fallbackImagePrompt(title: string, bullets?: string[]): string {
  const bulletText = bullets?.length
    ? ` Bullet points in white text: ${bullets.map((b) => `"${b}"`).join(", ")}.`
    : "";
  return `A professional presentation slide with dark navy background (#1a1a2e). Large bold white title text at the top reading "${title}".${bulletText} Subtle translucent maritime watermark (anchor or compass rose) in the background. Clean modern corporate aesthetic, widescreen 16:9 layout, no human faces`;
}

async function generateAndSaveImage(
  sessionId: number,
  slideIndex: number,
  prompt: string,
): Promise<string> {
  const response = await genai!.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  // Nano Banana Pro returns base64 image data inline
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No response from Nano Banana Pro");

  const imagePart = parts.find((p: any) => p.inlineData);
  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in Nano Banana Pro response");
  }

  const filename = `${sessionId}-${slideIndex}.png`;
  const filepath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(imagePart.inlineData.data, "base64"));

  return filename;
}

// ── POST /study/slideshow/images — Generate images for slides (SSE) ─────────

app.post("/study/slideshow/images", async (c) => {
  const body = await c.req.json();
  const { qualId, studyContentId, slides } = body as {
    qualId: string;
    studyContentId?: number;
    slides: Array<{
      title: string;
      bullets: string[];
      speakerNotes?: string;
      citations?: string[];
    }>;
  };

  if (!qualId || !slides?.length) {
    return c.json({ error: "qualId and slides are required" }, 400);
  }

  if (slides.length > 20) {
    return c.json({ error: "Maximum 20 slides" }, 400);
  }

  if (!genai) {
    return c.json({
      error: "Image generation not configured. Set GEMINI_API_KEY environment variable.",
    }, 503);
  }

  // Create session
  const sessionResult = db
    .prepare(
      `INSERT INTO slideshow_sessions (study_content_id, qual_id, status, slide_count) VALUES (?, ?, 'generating_images', ?)`,
    )
    .run(studyContentId ?? null, qualId, slides.length);
  const sessionId = sessionResult.lastInsertRowid as number;

  // Insert slide records
  const insertSlide = db.prepare(
    `INSERT INTO slideshow_slides (session_id, slide_index, title, bullets, speaker_notes, citations, image_status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
  );
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    insertSlide.run(
      sessionId,
      i,
      s.title,
      JSON.stringify(s.bullets),
      s.speakerNotes ?? null,
      s.citations ? JSON.stringify(s.citations) : null,
    );
  }

  // Ensure images directory exists
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "session",
      data: JSON.stringify({ sessionId, slideCount: slides.length }),
    });

    // Generate image prompts in parallel via Claude
    const prompts: string[] = [];
    const promptTasks = slides.map(async (s, i) => {
      const prompt = await generateImagePrompt(s.title, s.bullets);
      prompts[i] = prompt;

      // Save prompt to DB
      db.prepare(
        `UPDATE slideshow_slides SET image_prompt = ? WHERE session_id = ? AND slide_index = ?`,
      ).run(prompt, sessionId, i);

      await stream.writeSSE({
        event: "prompt",
        data: JSON.stringify({ slideIndex: i, prompt }),
      });
    });
    await Promise.all(promptTasks);

    // Generate images with concurrency limit of 3
    let completed = 0;
    let failed = 0;
    const concurrency = 3;
    let cursor = 0;

    async function processSlide(i: number) {
      db.prepare(
        `UPDATE slideshow_slides SET image_status = 'generating' WHERE session_id = ? AND slide_index = ?`,
      ).run(sessionId, i);

      try {
        const filename = await generateAndSaveImage(
          sessionId,
          i,
          prompts[i],
        );

        db.prepare(
          `UPDATE slideshow_slides SET image_status = 'ready', image_filename = ? WHERE session_id = ? AND slide_index = ?`,
        ).run(filename, sessionId, i);

        completed++;
        db.prepare(
          `UPDATE slideshow_sessions SET images_completed = ? WHERE id = ?`,
        ).run(completed, sessionId);

        await stream.writeSSE({
          event: "progress",
          data: JSON.stringify({
            slideIndex: i,
            status: "ready",
            filename,
            completed,
            total: slides.length,
          }),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";

        // Retry once after 2s
        try {
          await new Promise((r) => setTimeout(r, 2000));
          const filename = await generateAndSaveImage(
            sessionId,
            i,
            prompts[i],
          );

          db.prepare(
            `UPDATE slideshow_slides SET image_status = 'ready', image_filename = ? WHERE session_id = ? AND slide_index = ?`,
          ).run(filename, sessionId, i);

          completed++;
          db.prepare(
            `UPDATE slideshow_sessions SET images_completed = ? WHERE id = ?`,
          ).run(completed, sessionId);

          await stream.writeSSE({
            event: "progress",
            data: JSON.stringify({
              slideIndex: i,
              status: "ready",
              filename,
              completed,
              total: slides.length,
            }),
          });
        } catch {
          failed++;
          db.prepare(
            `UPDATE slideshow_slides SET image_status = 'failed', image_error = ? WHERE session_id = ? AND slide_index = ?`,
          ).run(errMsg, sessionId, i);

          await stream.writeSSE({
            event: "progress",
            data: JSON.stringify({
              slideIndex: i,
              status: "failed",
              error: errMsg,
              completed,
              total: slides.length,
            }),
          });
        }
      }
    }

    // Process slides with bounded concurrency
    const running: Promise<void>[] = [];
    while (cursor < slides.length) {
      while (running.length < concurrency && cursor < slides.length) {
        const idx = cursor++;
        const p = processSlide(idx).then(() => {
          running.splice(running.indexOf(p), 1);
        });
        running.push(p);
      }
      if (running.length >= concurrency) {
        await Promise.race(running);
      }
    }
    await Promise.all(running);

    // Update session status
    const finalStatus = failed === slides.length ? "error" : "ready";
    db.prepare(`UPDATE slideshow_sessions SET status = ? WHERE id = ?`).run(
      finalStatus,
      sessionId,
    );

    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        sessionId,
        status: finalStatus,
        completed,
        failed,
      }),
    });
  });
});

// ── POST /study/slideshow/images/:sessionId/regenerate/:slideIndex ───────────

app.post("/study/slideshow/images/:sessionId/regenerate/:slideIndex", async (c) => {
  const sessionId = Number(c.req.param("sessionId"));
  const slideIndex = Number(c.req.param("slideIndex"));

  if (!Number.isFinite(sessionId) || !Number.isFinite(slideIndex)) {
    return c.json({ error: "Invalid parameters" }, 400);
  }

  if (!genai) {
    return c.json({ error: "Image generation not configured" }, 503);
  }

  const slide = db
    .prepare(
      `SELECT * FROM slideshow_slides WHERE session_id = ? AND slide_index = ?`,
    )
    .get(sessionId, slideIndex) as {
    id: number;
    title: string;
    bullets: string;
    image_prompt: string | null;
  } | undefined;

  if (!slide) return c.json({ error: "Slide not found" }, 404);

  // Generate new prompt
  const bullets = JSON.parse(slide.bullets) as string[];
  const prompt = await generateImagePrompt(slide.title, bullets);

  db.prepare(
    `UPDATE slideshow_slides SET image_prompt = ?, image_status = 'generating', image_error = NULL WHERE session_id = ? AND slide_index = ?`,
  ).run(prompt, sessionId, slideIndex);

  try {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const filename = await generateAndSaveImage(sessionId, slideIndex, prompt);

    db.prepare(
      `UPDATE slideshow_slides SET image_status = 'ready', image_filename = ? WHERE session_id = ? AND slide_index = ?`,
    ).run(filename, sessionId, slideIndex);

    return c.json({ status: "ready", filename, prompt });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    db.prepare(
      `UPDATE slideshow_slides SET image_status = 'failed', image_error = ? WHERE session_id = ? AND slide_index = ?`,
    ).run(errMsg, sessionId, slideIndex);

    return c.json({ status: "failed", error: errMsg }, 500);
  }
});

// ── GET /study/slideshow/images/:filename — Serve stored images ─────────────

app.get("/study/slideshow/images/:filename", (c) => {
  const filename = c.req.param("filename");

  // Path traversal protection
  if (!filename || /[/\\]/.test(filename) || filename.includes("..")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  if (!/^\d+-\d+\.png$/.test(filename)) {
    return c.json({ error: "Invalid filename format" }, 400);
  }

  const filepath = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return c.json({ error: "Image not found" }, 404);
  }

  const buffer = fs.readFileSync(filepath);
  c.header("Content-Type", "image/png");
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(new Uint8Array(buffer));
});

// ── GET /study/slideshow/:sessionId — Get session with all slides ───────────

app.get("/study/slideshow/:sessionId", (c) => {
  const sessionId = Number(c.req.param("sessionId"));
  if (!Number.isFinite(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }

  const session = db
    .prepare(`SELECT * FROM slideshow_sessions WHERE id = ?`)
    .get(sessionId) as {
    id: number;
    qual_id: string;
    status: string;
    slide_count: number;
    images_completed: number;
  } | undefined;

  if (!session) return c.json({ error: "Session not found" }, 404);

  const slides = db
    .prepare(
      `SELECT * FROM slideshow_slides WHERE session_id = ? ORDER BY slide_index`,
    )
    .all(sessionId) as Array<{
    slide_index: number;
    title: string;
    bullets: string;
    speaker_notes: string | null;
    citations: string | null;
    image_prompt: string | null;
    image_filename: string | null;
    image_status: string;
    image_error: string | null;
  }>;

  return c.json({
    data: {
      sessionId: session.id,
      qualId: session.qual_id,
      status: session.status,
      slides: slides.map((s) => ({
        slideIndex: s.slide_index,
        title: s.title,
        bullets: JSON.parse(s.bullets),
        speakerNotes: s.speaker_notes,
        citations: s.citations ? JSON.parse(s.citations) : undefined,
        imagePrompt: s.image_prompt,
        imageFilename: s.image_filename,
        imageUrl: s.image_filename
          ? `/api/v1/study/slideshow/images/${s.image_filename}`
          : undefined,
        imageStatus: s.image_status,
        imageError: s.image_error,
      })),
      imagesCompleted: session.images_completed,
    },
  });
});

// ── GET /study/slideshow/:sessionId/export — Export as PPTX or PDF ──────────

app.get("/study/slideshow/:sessionId/export", async (c) => {
  const sessionId = Number(c.req.param("sessionId"));
  const format = (c.req.query("format") || "pptx") as "pptx" | "pdf";

  if (!Number.isFinite(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }
  if (format !== "pptx" && format !== "pdf") {
    return c.json({ error: "Format must be pptx or pdf" }, 400);
  }

  const session = db
    .prepare(`SELECT * FROM slideshow_sessions WHERE id = ?`)
    .get(sessionId) as { id: number; qual_id: string } | undefined;

  if (!session) return c.json({ error: "Session not found" }, 404);

  const slides = db
    .prepare(
      `SELECT * FROM slideshow_slides WHERE session_id = ? ORDER BY slide_index`,
    )
    .all(sessionId) as Array<{
    slide_index: number;
    title: string;
    bullets: string;
    speaker_notes: string | null;
    citations: string | null;
    image_filename: string | null;
    image_status: string;
  }>;

  if (!slides.length) {
    return c.json({ error: "No slides found" }, 404);
  }

  // Load images into buffers
  const imageBuffers: Map<number, Buffer> = new Map();
  for (const s of slides) {
    if (s.image_filename && s.image_status === "ready") {
      const fp = path.join(IMAGES_DIR, s.image_filename);
      if (fs.existsSync(fp)) {
        imageBuffers.set(s.slide_index, fs.readFileSync(fp));
      }
    }
  }

  const qualDef = QUAL_MAP.get(session.qual_id);
  const deckTitle = qualDef
    ? `${qualDef.label} — Study Slideshow`
    : "Study Slideshow";

  if (format === "pptx") {
    const PptxGenJS = (await import("pptxgenjs")).default;
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE"; // 16:9
    pres.author = "MIAgent";
    pres.title = deckTitle;

    // Define dark theme colors
    const BG_COLOR = "1a1a2e";
    const TEXT_COLOR = "e0e0e0";
    const ACCENT_COLOR = "4fc3f7";
    const MUTED_COLOR = "888888";

    for (const s of slides) {
      const slide = pres.addSlide();
      const bullets = JSON.parse(s.bullets) as string[];
      const hasImage = imageBuffers.has(s.slide_index);

      if (hasImage) {
        // Full-page slide image (text is baked into the image)
        const imgBuf = imageBuffers.get(s.slide_index)!;
        const mime = imgBuf[0] === 0xFF ? "image/jpeg" : "image/png";
        slide.addImage({
          data: `${mime};base64,${imgBuf.toString("base64")}`,
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
        });
      } else {
        // Text-only fallback
        slide.background = { color: BG_COLOR };

        slide.addText(s.title, {
          x: 0.5,
          y: 0.3,
          w: 12,
          h: 0.7,
          fontSize: 24,
          bold: true,
          color: TEXT_COLOR,
          fontFace: "Arial",
        });

        slide.addText(
          bullets.map((b) => ({
            text: b,
            options: {
              bullet: { code: "2022" },
              fontSize: 14,
              color: TEXT_COLOR,
              fontFace: "Arial",
              lineSpacingMultiple: 1.5,
            },
          })),
          {
            x: 0.5,
            y: 1.2,
            w: 12,
            h: 4.5,
            valign: "top",
          },
        );

        const citations = s.citations ? JSON.parse(s.citations) as string[] : [];
        if (citations.length > 0) {
          slide.addText(citations.join(" | "), {
            x: 0.5,
            y: 6.8,
            w: 12,
            h: 0.4,
            fontSize: 9,
            color: ACCENT_COLOR,
            fontFace: "Arial",
          });
        }
      }

      // Speaker notes always added
      if (s.speaker_notes) {
        slide.addNotes(s.speaker_notes);
      }
    }

    const buffer = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
    c.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    c.header(
      "Content-Disposition",
      `attachment; filename="${session.qual_id}-slideshow.pptx"`,
    );
    return c.body(new Uint8Array(buffer));
  }

  // PDF export
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(deckTitle);
  pdfDoc.setAuthor("MIAgent");

  // Landscape A4
  const W = 841.89;
  const H = 595.28;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  /** Render a text-only slide on the given PDF page. */
  function renderTextSlide(
    page: Awaited<ReturnType<typeof PDFDocument.create>> extends { addPage: (...a: any[]) => infer P } ? P : any,
    s: typeof slides[number],
  ) {
    const bullets = JSON.parse(s.bullets) as string[];

    // Background
    page.drawRectangle({
      x: 0, y: 0, width: W, height: H,
      color: rgb(0.1, 0.1, 0.18),
    });

    // Title
    page.drawText(s.title, {
      x: 40,
      y: H - 50,
      size: 22,
      font: fontBold,
      color: rgb(0.88, 0.88, 0.88),
      maxWidth: W - 80,
    });

    // Bullets
    let bulletY = H - 90;
    for (const b of bullets) {
      if (bulletY < 80) break;
      const lines = wrapText(b, font, 13, W - 110);
      for (const line of lines) {
        if (bulletY < 80) break;
        page.drawText(`\u2022  ${line}`, {
          x: 50,
          y: bulletY,
          size: 13,
          font,
          color: rgb(0.88, 0.88, 0.88),
        });
        bulletY -= 20;
      }
      bulletY -= 5;
    }

    // Citations
    const citations = s.citations ? JSON.parse(s.citations) as string[] : [];
    if (citations.length > 0) {
      page.drawText(citations.join(" | "), {
        x: 40,
        y: 25,
        size: 8,
        font,
        color: rgb(0.31, 0.76, 0.97),
        maxWidth: W - 80,
      });
    }
  }

  for (const s of slides) {
    const page = pdfDoc.addPage([W, H]);
    const hasImage = imageBuffers.has(s.slide_index);

    if (hasImage) {
      try {
        const imgBuf = imageBuffers.get(s.slide_index)!;
        // Gemini may return JPEG despite .png extension — try both formats
        const image = imgBuf[0] === 0xFF
          ? await pdfDoc.embedJpg(imgBuf)
          : await pdfDoc.embedPng(imgBuf);
        const dims = image.scaleToFit(W, H);
        page.drawImage(image, {
          x: (W - dims.width) / 2,
          y: (H - dims.height) / 2,
          width: dims.width,
          height: dims.height,
        });
      } catch {
        // Image embed failed — fall back to text slide
        renderTextSlide(page, s);
      }
    } else {
      renderTextSlide(page, s);
    }
  }

  const pdfBytes = await pdfDoc.save();
  c.header("Content-Type", "application/pdf");
  c.header(
    "Content-Disposition",
    `attachment; filename="${session.qual_id}-slideshow.pdf"`,
  );
  return c.body(new Uint8Array(pdfBytes));
});

/** Simple word-wrap for pdf-lib (no built-in text wrapping). */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default app;

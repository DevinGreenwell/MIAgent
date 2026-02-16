/** Document routes — collections, topics, vessel types, documents, search, coverage, stats. */
import { Hono } from "hono";
import db from "../db.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { getCfrPartTitle } from "../cfr-titles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const app = new Hono();

// GET /collections
app.get("/collections", (c) => {
  const rows = db.prepare("SELECT id, name, slug, doc_count FROM collections ORDER BY name").all();
  return c.json({ data: rows });
});

// GET /topics
app.get("/topics", (c) => {
  const rows = db.prepare("SELECT id, name, slug, doc_count FROM topics WHERE doc_count > 0 ORDER BY name").all();
  return c.json({ data: rows });
});

// GET /vessel-types
app.get("/vessel-types", (c) => {
  const rows = db.prepare("SELECT id, name, slug, doc_count FROM vessel_types WHERE doc_count > 0 ORDER BY name").all();
  return c.json({ data: rows });
});

// GET /cfr-sections
app.get("/cfr-sections", (c) => {
  const rows = db.prepare("SELECT id, label, title, part, subpart FROM cfr_sections ORDER BY label").all();
  return c.json({ data: rows });
});

// GET /documents — paginated, filtered
app.get("/documents", (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "25")));
  const offset = (page - 1) * limit;

  const collection = c.req.query("collection");
  const topic = c.req.query("topic");
  const vessel = c.req.query("vessel");

  let where = "1=1";
  const params: unknown[] = [];

  if (collection) {
    where += " AND d.collection_id = ?";
    params.push(collection);
  }

  if (topic) {
    where += " AND d.id IN (SELECT dt.document_id FROM document_topics dt JOIN topics t ON t.id = dt.topic_id WHERE t.slug = ?)";
    params.push(topic);
  }

  if (vessel) {
    where += " AND d.id IN (SELECT dv.document_id FROM document_vessel_types dv JOIN vessel_types v ON v.id = dv.vessel_type_id WHERE v.slug = ?)";
    params.push(vessel);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM documents d WHERE ${where}`).get(...params) as { total: number };
  const total = countRow.total;
  const pages = Math.ceil(total / limit);

  const rows = db.prepare(`
    SELECT d.id, d.document_id, d.title, d.filename, d.collection_id, d.subcategory, d.year, d.status, d.summary
    FROM documents d
    WHERE ${where}
    ORDER BY d.collection_id,
      CASE WHEN d.collection_id = 'cfr' THEN
        CAST(SUBSTR(d.document_id, 5, 2) AS INTEGER)
      END,
      CASE WHEN d.collection_id = 'cfr' THEN
        CAST(
          CASE
            WHEN d.document_id LIKE 'cfr/%-Part-%' THEN REPLACE(SUBSTR(d.document_id, INSTR(d.document_id, 'Part-') + 5), '/', '')
            WHEN d.document_id LIKE 'cfr/%-part%' THEN REPLACE(SUBSTR(d.document_id, INSTR(d.document_id, 'part') + 4), '/', '')
          END
        AS INTEGER)
      END,
      CASE WHEN d.collection_id = 'class-rules' THEN
        CASE
          WHEN d.document_id LIKE 'class-rules/ABS%' THEN 0
          ELSE 1
        END
      END,
      CASE WHEN d.collection_id = 'class-rules' THEN
        CAST(
          CASE
            WHEN d.document_id LIKE 'class-rules/ABS-part%' THEN REPLACE(SUBSTR(d.document_id, INSTR(d.document_id, 'part') + 4), '/', '')
            WHEN d.document_id LIKE 'class-rules/IACS%' THEN SUBSTR(d.document_id, INSTR(d.document_id, 'IACS') + 4)
          END
        AS INTEGER)
      END,
      d.year DESC, d.title
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Enrich CFR documents with part titles
  const enrichedRows = (rows as Array<Record<string, unknown>>).map((row) => {
    if (row.collection_id === "cfr") {
      const partTitle = getCfrPartTitle(row.document_id as string);
      if (partTitle) return { ...row, part_title: partTitle };
    }
    return row;
  });

  return c.json({
    data: enrichedRows,
    pagination: { page, pages, total, limit },
  });
});

// GET /search — full-text search
app.get("/search", (c) => {
  const q = c.req.query("q") || "";
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "25")));
  const offset = (page - 1) * limit;
  const collection = c.req.query("collection");
  const topic = c.req.query("topic");

  if (!q) {
    return c.json({ data: [], pagination: { page: 1, pages: 0, total: 0, limit } });
  }

  let where = "";
  const params: unknown[] = [];

  if (collection) {
    where += " AND d.collection_id = ?";
    params.push(collection);
  }

  if (topic) {
    where += " AND d.id IN (SELECT dt.document_id FROM document_topics dt JOIN topics t ON t.id = dt.topic_id WHERE t.slug = ?)";
    params.push(topic);
  }

  const ftsQuery = q.split(/\s+/).map((w) => `"${w}"`).join(" OR ");

  const countRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM documents d
    JOIN documents_fts fts ON fts.rowid = d.id
    WHERE documents_fts MATCH ? ${where}
  `).get(ftsQuery, ...params) as { total: number };

  const total = countRow.total;
  const pages = Math.ceil(total / limit);

  const rows = db.prepare(`
    SELECT d.id, d.document_id, d.title, d.filename, d.collection_id, d.subcategory, d.year, d.status, d.summary,
           rank
    FROM documents d
    JOIN documents_fts fts ON fts.rowid = d.id
    WHERE documents_fts MATCH ? ${where}
    ORDER BY rank
    LIMIT ? OFFSET ?
  `).all(ftsQuery, ...params, limit, offset);

  // Enrich CFR documents with part titles
  const enrichedRows = (rows as Array<Record<string, unknown>>).map((row) => {
    if (row.collection_id === "cfr") {
      const partTitle = getCfrPartTitle(row.document_id as string);
      if (partTitle) return { ...row, part_title: partTitle };
    }
    return row;
  });

  return c.json({
    data: enrichedRows,
    pagination: { page, pages, total, limit },
  });
});

// GET /documents/:id — single document with joined details
app.get("/documents/:id", (c) => {
  const id = parseInt(c.req.param("id"));

  const doc = db.prepare(`
    SELECT id, document_id, title, filename, filepath, collection_id, subcategory, year, revision, status, summary
    FROM documents WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  // Enrich CFR documents with part title
  if (doc.collection_id === "cfr") {
    const partTitle = getCfrPartTitle(doc.document_id as string);
    if (partTitle) doc.part_title = partTitle;
  }

  const topics = db.prepare(`
    SELECT t.id, t.name, t.slug
    FROM topics t
    JOIN document_topics dt ON dt.topic_id = t.id
    WHERE dt.document_id = ?
  `).all(id);

  const vessel_types = db.prepare(`
    SELECT v.id, v.name, v.slug
    FROM vessel_types v
    JOIN document_vessel_types dv ON dv.vessel_type_id = v.id
    WHERE dv.document_id = ?
  `).all(id);

  const cfr_sections = db.prepare(`
    SELECT cs.id, cs.label, cs.title, cs.part, cs.subpart
    FROM cfr_sections cs
    JOIN document_cfr_sections dcs ON dcs.cfr_section_id = cs.id
    WHERE dcs.document_id = ?
  `).all(id);

  const related = db.prepare(`
    SELECT d.id, d.document_id, d.title, dr.relationship_type
    FROM document_relationships dr
    JOIN documents d ON d.id = dr.target_id
    WHERE dr.source_id = ?
  `).all(id);

  return c.json({
    data: {
      ...doc,
      topics,
      vessel_types,
      cfr_sections,
      related,
    },
  });
});

// GET /documents/:id/pdf — serve the PDF file
app.get("/documents/:id/pdf", (c) => {
  const id = parseInt(c.req.param("id"));

  const doc = db.prepare("SELECT filepath, filename FROM documents WHERE id = ?").get(id) as
    | { filepath: string; filename: string }
    | undefined;

  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const fullPath = path.join(ROOT, doc.filepath);

  if (!fs.existsSync(fullPath)) {
    return c.json({ error: "PDF file not found" }, 404);
  }

  const buffer = fs.readFileSync(fullPath);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.filename}"`,
    },
  });
});

// GET /coverage
app.get("/coverage", (c) => {
  const topic = c.req.query("topic");

  let rows;
  if (topic) {
    rows = db.prepare(`
      SELECT c.id, c.name, COUNT(d.id) as doc_count
      FROM collections c
      LEFT JOIN documents d ON d.collection_id = c.id
        AND d.id IN (SELECT dt.document_id FROM document_topics dt JOIN topics t ON t.id = dt.topic_id WHERE t.slug = ?)
      GROUP BY c.id
      ORDER BY c.name
    `).all(topic);
  } else {
    rows = db.prepare(`
      SELECT c.id, c.name, c.doc_count
      FROM collections c
      ORDER BY c.name
    `).all();
  }

  return c.json({ data: rows });
});

// GET /stats
app.get("/stats", (c) => {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM documents) as documents,
      (SELECT COUNT(*) FROM collections WHERE doc_count > 0) as collections,
      (SELECT COUNT(*) FROM topics WHERE doc_count > 0) as topics
  `).get();

  return c.json({ data: stats });
});

// GET /health
app.get("/health", (c) => {
  return c.json({ data: { status: "ok" } });
});

export default app;

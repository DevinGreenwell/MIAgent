/**
 * Ingest MSM Volume 3 individual section PDFs into the database.
 *
 * Replaces the single monolithic MSM-vol3 document with granular
 * section documents, extracts text, and tags with relevant topics.
 *
 * Usage: npx tsx scripts/ingest-msm-vol3-parts.ts
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../db/miagent.db");
const PARTS_DIR = path.resolve(__dirname, "../MSM/MSM-vol3-parts");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Section metadata: topic IDs and subcategory labels ──────────────

interface SectionMeta {
  subcategory: string;
  topicIds: number[];
}

// Topic IDs from the database:
// 184=Inspection Programs
// (Vol 3 is about personnel/credentialing — less overlap with inspection topics)

const SECTION_META: Record<string, SectionMeta> = {
  // ── Section A: Licensing & Credentialing ──
  A1:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A2:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A3:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A4:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A5:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A6:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A7:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A8:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A9:  { subcategory: "Licensing and Credentialing", topicIds: [] },
  A10: { subcategory: "Licensing and Credentialing", topicIds: [] },
  A11: { subcategory: "Licensing and Credentialing", topicIds: [] },
  A12: { subcategory: "Licensing and Credentialing", topicIds: [] },
  A13: { subcategory: "Licensing and Credentialing", topicIds: [] },
  A14: { subcategory: "Licensing and Credentialing", topicIds: [] },
  A15: { subcategory: "Licensing and Credentialing", topicIds: [] },
  A16: { subcategory: "Licensing and Credentialing", topicIds: [] },
  A17: { subcategory: "Licensing and Credentialing", topicIds: [] },

  // ── Section B: Vessel Manning ──
  B1: { subcategory: "Vessel Manning", topicIds: [184] },
  B2: { subcategory: "Vessel Manning", topicIds: [184] },
  B3: { subcategory: "Vessel Manning", topicIds: [184] },
  B4: { subcategory: "Vessel Manning", topicIds: [184] },
  B5: { subcategory: "Vessel Manning", topicIds: [184] },
  B6: { subcategory: "Vessel Manning", topicIds: [184] },
  B7: { subcategory: "Vessel Manning", topicIds: [184] },

  // ── Section C: Other ──
  C1: { subcategory: "Seaman Services", topicIds: [] },
  C2: { subcategory: "Seaman Services", topicIds: [] },

  // ── Reference / Supporting ──
  ABB:         { subcategory: "Reference", topicIds: [] },
  ANNEX:       { subcategory: "Reference", topicIds: [] },
  FrontMatter: { subcategory: "General", topicIds: [] },
  LIF:         { subcategory: "Reference", topicIds: [] },
};

// ── Helpers ─────────────────────────────────────────────────────────

function parseSectionCode(filename: string): string {
  // MSM-vol3_A1_Authority_... → A1
  // MSM-vol3_FrontMatter_... → FrontMatter
  // MSM-vol3_ABB_Acronyms... → ABB
  // MSM-vol3_ANNEX_Annex... → ANNEX
  // MSM-vol3_LIF_List... → LIF
  const match = filename.match(/^MSM-vol3_([A-C]\d+|FrontMatter|ABB|ANNEX|LIF)_?/);
  return match ? match[1] : "";
}

function buildTitle(filename: string): string {
  const base = filename.replace(/\.pdf$/, "").replace(/^MSM-vol3_/, "");
  const sectionMatch = base.match(/^([A-C]\d+)_(.+)$/);
  if (sectionMatch) {
    const [, code, rest] = sectionMatch;
    const title = rest.replace(/_/g, " ");
    return `MSM Vol 3 - ${code}: ${title}`;
  }
  if (base.startsWith("FrontMatter")) return "MSM Vol 3 - Front Matter";
  if (base.startsWith("ABB")) return "MSM Vol 3 - Acronyms and Abbreviations";
  if (base.startsWith("ANNEX")) return "MSM Vol 3 - Annex";
  if (base.startsWith("LIF")) return "MSM Vol 3 - List of Figures";
  return `MSM Vol 3 - ${base.replace(/_/g, " ")}`;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const files = fs
    .readdirSync(PARTS_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort();

  console.log(`Found ${files.length} MSM Vol 3 section PDFs`);

  // ── Step 1: Remove old monolithic MSM-vol3 ────────────────────────
  const oldDoc = db
    .prepare("SELECT id FROM documents WHERE document_id = 'msm/MSM-vol3'")
    .get() as { id: number } | undefined;

  if (oldDoc) {
    console.log(`Removing old monolithic MSM-vol3 (id=${oldDoc.id})...`);
    db.prepare("DELETE FROM document_topics WHERE document_id = ?").run(oldDoc.id);
    db.prepare("DELETE FROM document_vessel_types WHERE document_id = ?").run(oldDoc.id);
    db.prepare("DELETE FROM document_cfr_sections WHERE document_id = ?").run(oldDoc.id);
    db.prepare("DELETE FROM document_relationships WHERE source_id = ? OR target_id = ?").run(oldDoc.id, oldDoc.id);
    db.prepare("DELETE FROM document_text WHERE document_id = ?").run(oldDoc.id);
    db.prepare("DELETE FROM documents WHERE id = ?").run(oldDoc.id);
    console.log("  Old document removed.");
  }

  // ── Step 2: Insert new section documents ──────────────────────────
  const insertDoc = db.prepare(`
    INSERT OR IGNORE INTO documents
      (document_id, title, filename, filepath, collection_id, subcategory, status)
    VALUES (?, ?, ?, ?, 'msm', ?, 'active')
  `);

  const insertText = db.prepare(`
    INSERT OR REPLACE INTO document_text (document_id, content)
    VALUES (?, ?)
  `);

  const insertTopic = db.prepare(`
    INSERT OR IGNORE INTO document_topics (document_id, topic_id)
    VALUES (?, ?)
  `);

  let inserted = 0;
  let extracted = 0;
  let failed: string[] = [];

  const transaction = db.transaction(() => {
    for (const filename of files) {
      const sectionCode = parseSectionCode(filename);
      const docId = `msm/${filename.replace(/\.pdf$/, "")}`;
      const title = buildTitle(filename);
      const filepath = `MSM/MSM-vol3-parts/${filename}`;
      const meta = sectionCode ? SECTION_META[sectionCode] : undefined;
      const subcategory = meta?.subcategory ?? "General";

      insertDoc.run(docId, title, filename, filepath, subcategory);
      inserted++;

      const row = db
        .prepare("SELECT id FROM documents WHERE document_id = ?")
        .get(docId) as { id: number };

      if (meta?.topicIds) {
        for (const topicId of meta.topicIds) {
          insertTopic.run(row.id, topicId);
        }
      }
    }
  });

  transaction();
  console.log(`Inserted ${inserted} section documents`);

  // ── Step 3: Extract text from each PDF ────────────────────────────
  console.log("Extracting text from PDFs...");

  for (const filename of files) {
    const docId = `msm/${filename.replace(/\.pdf$/, "")}`;
    const row = db
      .prepare("SELECT id FROM documents WHERE document_id = ?")
      .get(docId) as { id: number };

    const existing = db
      .prepare("SELECT 1 FROM document_text WHERE document_id = ?")
      .get(row.id);
    if (existing) {
      extracted++;
      continue;
    }

    const pdfPath = path.join(PARTS_DIR, filename);
    try {
      const buffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(buffer);
      const text = data.text.trim();

      if (text.length > 50) {
        insertText.run(row.id, text);
        extracted++;
        process.stdout.write(".");
      } else {
        failed.push(filename);
        process.stdout.write("x");
      }
    } catch (err) {
      failed.push(filename);
      process.stdout.write("x");
      console.error(`\n  Failed: ${filename}: ${(err as Error).message}`);
    }
  }

  console.log(`\nExtracted text from ${extracted}/${files.length} PDFs`);
  if (failed.length) {
    console.log(`Failed (may need OCR): ${failed.join(", ")}`);
  }

  // ── Step 4: Update counts ─────────────────────────────────────────
  db.prepare(`
    UPDATE collections SET doc_count = (
      SELECT COUNT(*) FROM documents WHERE collection_id = 'msm'
    ) WHERE id = 'msm'
  `).run();

  db.prepare(`
    UPDATE topics SET doc_count = (
      SELECT COUNT(*) FROM document_topics dt
      JOIN documents d ON dt.document_id = d.id
      WHERE dt.topic_id = topics.id
    ) WHERE id IN (SELECT DISTINCT topic_id FROM document_topics)
  `).run();

  const count = db
    .prepare("SELECT doc_count FROM collections WHERE id = 'msm'")
    .get() as { doc_count: number };
  console.log(`MSM collection now has ${count.doc_count} documents`);

  console.log("\n--- Summary ---");
  console.log(`Documents inserted: ${inserted}`);
  console.log(`Text extracted: ${extracted}`);
  console.log(`Failed extractions: ${failed.length}`);
  console.log(
    "\nNext step: run embedding for new documents."
  );

  // Print new doc IDs for embedding
  const newDocs = db
    .prepare("SELECT id FROM documents WHERE collection_id = 'msm' AND document_id LIKE '%vol3%' AND document_id != 'msm/MSM-vol3' ORDER BY id")
    .all() as Array<{ id: number }>;
  console.log(`Doc IDs for embedding: ${newDocs.map((d) => d.id).join(",")}`);

  db.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

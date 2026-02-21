/**
 * Ingest MSM Volume 2 individual section PDFs into the database.
 *
 * Replaces the single monolithic MSM-vol2 document with 44 granular
 * section documents, extracts text, and tags with relevant topics.
 *
 * Usage: npx tsx scripts/ingest-msm-vol2-parts.ts
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, "../db/miagent.db");
const PARTS_DIR = path.resolve(__dirname, "../MSM/MSM-vol2-parts");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Section metadata: topic IDs and subcategory labels ──────────────

interface SectionMeta {
  subcategory: string;
  topicIds: number[];
}

// Topic IDs from the database:
// 147=Barges, 154=Cargo, 561=Dry Dock Inspection, 163=Fire Safety,
// 184=Inspection Programs, 200=Load Lines, 352=MARPOL, 261=OCS MODUs,
// 270=Passenger Vessel Safety, 273=Plan Review, 282=SOLAS, 299=Stability

const SECTION_META: Record<string, SectionMeta> = {
  // ── Section A: Administration & Authority ──
  A1: { subcategory: "Administration", topicIds: [184] },
  A2: { subcategory: "Administration", topicIds: [184] },
  A3: { subcategory: "Administration", topicIds: [184] },
  A4: { subcategory: "Administration", topicIds: [273] },
  A5: { subcategory: "Administration", topicIds: [184] },
  A6: { subcategory: "Administration", topicIds: [184] },
  A7: { subcategory: "Administration", topicIds: [184] },

  // ── Section B: Inspection Procedures ──
  B1:  { subcategory: "Inspection Procedures", topicIds: [184] },
  B2:  { subcategory: "Inspection Procedures", topicIds: [184] },
  B3:  { subcategory: "Inspection Procedures", topicIds: [184, 561] },
  B4:  { subcategory: "Inspection Procedures", topicIds: [184] },
  B5:  { subcategory: "Inspection Procedures", topicIds: [184] },
  B6:  { subcategory: "Inspection Procedures", topicIds: [184] },
  B7:  { subcategory: "Inspection Procedures", topicIds: [184] },
  B9:  { subcategory: "Inspection Procedures", topicIds: [184] },
  B10: { subcategory: "Inspection Procedures", topicIds: [184] },

  // ── Section C: Equipment & Materials ──
  C1: { subcategory: "Equipment and Materials", topicIds: [184] },
  C2: { subcategory: "Equipment and Materials", topicIds: [184] },
  C3: { subcategory: "Equipment and Materials", topicIds: [184] },
  C4: { subcategory: "Equipment and Materials", topicIds: [184] },
  C5: { subcategory: "Equipment and Materials", topicIds: [184] },

  // ── Section D: Port State Control ──
  D1: { subcategory: "Port State Control", topicIds: [184] },
  D2: { subcategory: "Port State Control", topicIds: [184] },
  D3: { subcategory: "Port State Control", topicIds: [184] },
  D4: { subcategory: "Port State Control", topicIds: [184] },
  D5: { subcategory: "Port State Control", topicIds: [184, 154] },
  D6: { subcategory: "Port State Control", topicIds: [184] },
  D7: { subcategory: "Port State Control", topicIds: [184, 270] },

  // ── Section E: International Conventions ──
  E1: { subcategory: "International Conventions", topicIds: [184, 352] },
  E2: { subcategory: "International Conventions", topicIds: [184, 282] },
  E3: { subcategory: "International Conventions", topicIds: [184] },
  E4: { subcategory: "International Conventions", topicIds: [184, 200] },

  // ── Section F: Hazardous Materials ──
  F1: { subcategory: "Hazardous Materials", topicIds: [184] },
  F2: { subcategory: "Hazardous Materials", topicIds: [184, 163] },
  F3: { subcategory: "Hazardous Materials", topicIds: [184] },
  F4: { subcategory: "Hazardous Materials", topicIds: [184] },
  F5: { subcategory: "Hazardous Materials", topicIds: [184] },

  // ── Section G: OCS & MODUs ──
  G1: { subcategory: "OCS and MODUs", topicIds: [184, 261] },
  G2: { subcategory: "OCS and MODUs", topicIds: [184, 261] },
  G3: { subcategory: "OCS and MODUs", topicIds: [184, 261] },
  G4: { subcategory: "OCS and MODUs", topicIds: [184, 261] },
  G5: { subcategory: "OCS and MODUs", topicIds: [184, 261] },
  G6: { subcategory: "OCS and MODUs", topicIds: [184, 261] },

  // ── Front Matter ──
  FrontMatter: { subcategory: "Administration", topicIds: [184] },
};

// ── Helpers ─────────────────────────────────────────────────────────

function parseSectionCode(filename: string): string {
  // MSM-vol2_A1_Authority_... → A1
  // MSM-vol2_FrontMatter.pdf → FrontMatter
  const match = filename.match(/^MSM-vol2_([A-G]\d+|FrontMatter)_?/);
  return match ? match[1] : "";
}

function buildTitle(filename: string): string {
  // MSM-vol2_B3_Hull_Examinations.pdf → "MSM Vol 2 - B3: Hull Examinations"
  const base = filename.replace(/\.pdf$/, "").replace(/^MSM-vol2_/, "");
  const sectionMatch = base.match(/^([A-G]\d+)_(.+)$/);
  if (sectionMatch) {
    const [, code, rest] = sectionMatch;
    const title = rest.replace(/_/g, " ");
    return `MSM Vol 2 - ${code}: ${title}`;
  }
  if (base === "FrontMatter") {
    return "MSM Vol 2 - Front Matter";
  }
  return `MSM Vol 2 - ${base.replace(/_/g, " ")}`;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const files = fs
    .readdirSync(PARTS_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort();

  console.log(`Found ${files.length} MSM Vol 2 section PDFs`);

  // ── Step 1: Remove old monolithic MSM-vol2 ────────────────────────
  const oldDoc = db
    .prepare("SELECT id FROM documents WHERE document_id = 'msm/MSM-vol2'")
    .get() as { id: number } | undefined;

  if (oldDoc) {
    console.log(`Removing old monolithic MSM-vol2 (id=${oldDoc.id})...`);
    db.prepare("DELETE FROM document_topics WHERE document_id = ?").run(oldDoc.id);
    db.prepare("DELETE FROM document_vessel_types WHERE document_id = ?").run(oldDoc.id);
    db.prepare("DELETE FROM document_cfr_sections WHERE document_id = ?").run(oldDoc.id);
    db.prepare("DELETE FROM document_relationships WHERE source_id = ? OR target_id = ?").run(oldDoc.id, oldDoc.id);
    db.prepare("DELETE FROM document_text WHERE document_id = ?").run(oldDoc.id);
    // The documents_fts trigger handles FTS cleanup on delete
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
      const filepath = `MSM/MSM-vol2-parts/${filename}`;
      const meta = sectionCode ? SECTION_META[sectionCode] : undefined;
      const subcategory = meta?.subcategory ?? "General";

      insertDoc.run(docId, title, filename, filepath, subcategory);
      inserted++;

      // Get the inserted doc's integer ID
      const row = db
        .prepare("SELECT id FROM documents WHERE document_id = ?")
        .get(docId) as { id: number };

      // Tag with topics
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

    // Check if text already extracted
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

  // ── Step 4: Update collection doc_count ───────────────────────────
  db.prepare(`
    UPDATE collections SET doc_count = (
      SELECT COUNT(*) FROM documents WHERE collection_id = 'msm'
    ) WHERE id = 'msm'
  `).run();

  // Update topic doc_counts
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

  // ── Summary ───────────────────────────────────────────────────────
  console.log("\n--- Summary ---");
  console.log(`Documents inserted: ${inserted}`);
  console.log(`Text extracted: ${extracted}`);
  console.log(`Failed extractions: ${failed.length}`);
  console.log(
    "\nNext step: run `npm run embed` to generate vector embeddings for new documents."
  );

  db.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

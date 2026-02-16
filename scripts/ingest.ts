/**
 * Ingest PDF documents from collection directories into the database.
 * Run: npm run ingest
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Collection directory mapping
const COLLECTIONS: Record<string, { dir: string; name: string; slug: string }> = {
  cfr: { dir: "CFR", name: "Code of Federal Regulations", slug: "cfr" },
  nvic: { dir: "NVIC", name: "Navigation and Vessel Inspection Circulars", slug: "nvic" },
  "policy-letter": { dir: "Policy Letter", name: "Policy Letters", slug: "policy-letter" },
  prg: { dir: "Plan Review Guides", name: "Plan Review Guides", slug: "prg" },
  mtn: { dir: "Marine Technical Notes", name: "Marine Technical Notes", slug: "mtn" },
  "io-guidance": { dir: "IO-Guidance", name: "IO Guidance", slug: "io-guidance" },
  "class-rules": { dir: "Class Rules", name: "Class Rules", slug: "class-rules" },
  msm: { dir: "MSM", name: "Marine Safety Manual", slug: "msm" },
  imo: { dir: "IMO", name: "International Maritime Organization", slug: "imo" },
};

const insertCollection = db.prepare(
  "INSERT OR IGNORE INTO collections (id, name, slug) VALUES (?, ?, ?)"
);
const insertDocument = db.prepare(
  "INSERT OR IGNORE INTO documents (document_id, title, filename, filepath, collection_id, subcategory, year) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
const insertTopic = db.prepare(
  "INSERT OR IGNORE INTO topics (name, slug) VALUES (?, ?)"
);
const getTopicId = db.prepare("SELECT id FROM topics WHERE slug = ?");
const insertDocTopic = db.prepare(
  "INSERT OR IGNORE INTO document_topics (document_id, topic_id) VALUES (?, ?)"
);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseTitle(filename: string): { title: string; year: number | null } {
  const name = filename.replace(/\.pdf$/i, "");
  // Try to extract year (2-digit or 4-digit)
  const yearMatch = name.match(/[-_](\d{4})[-_]|[-_](\d{2})[-_]/);
  let year: number | null = null;
  if (yearMatch) {
    const y = parseInt(yearMatch[1] || yearMatch[2]);
    year = y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
  }
  // Clean up the title
  const title = name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
  return { title, year };
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden directories
      if (!entry.name.startsWith(".")) {
        results.push(...walkDir(fullPath));
      }
    } else if (entry.name.toLowerCase().endsWith(".pdf")) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log("Ingesting documents...\n");

let totalDocs = 0;

for (const [collId, coll] of Object.entries(COLLECTIONS)) {
  insertCollection.run(collId, coll.name, coll.slug);

  const collDir = path.join(ROOT, coll.dir);
  const pdfs = walkDir(collDir);

  for (const pdfPath of pdfs) {
    const filename = path.basename(pdfPath);
    const relPath = path.relative(ROOT, pdfPath);
    const { title, year } = parseTitle(filename);

    // Derive document_id from collection + filename
    const docId = `${collId}/${filename.replace(/\.pdf$/i, "")}`;

    // Derive subcategory from subdirectory
    const relToCollection = path.relative(collDir, pdfPath);
    const parts = relToCollection.split(path.sep);
    const subcategory = parts.length > 1 ? parts.slice(0, -1).join("/") : null;

    insertDocument.run(docId, title, filename, relPath, collId, subcategory, year);
    totalDocs++;

    // Create topic from subdirectory if present
    if (subcategory) {
      const topicSlug = slugify(subcategory);
      const topicName = subcategory
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      insertTopic.run(topicName, topicSlug);

      const topic = getTopicId.get(topicSlug) as { id: number } | undefined;
      const doc = db
        .prepare("SELECT id FROM documents WHERE document_id = ?")
        .get(docId) as { id: number } | undefined;
      if (topic && doc) {
        insertDocTopic.run(doc.id, topic.id);
      }
    }
  }

  console.log(`  ${coll.name}: ${pdfs.length} documents`);
}

// Update doc_count for collections and topics
db.exec(`
  UPDATE collections SET doc_count = (SELECT COUNT(*) FROM documents WHERE collection_id = collections.id);
  UPDATE topics SET doc_count = (SELECT COUNT(*) FROM document_topics WHERE topic_id = topics.id);
`);

console.log(`\nIngestion complete: ${totalDocs} documents.`);
db.close();

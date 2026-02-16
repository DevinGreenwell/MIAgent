/**
 * Extract text content from PDFs and store in document_text table.
 * Run: npm run extract
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const insertText = db.prepare(
  "INSERT OR REPLACE INTO document_text (document_id, content) VALUES (?, ?)"
);

// Get all documents that don't have text extracted yet
const documents = db
  .prepare(
    `
  SELECT d.id, d.filepath, d.document_id
  FROM documents d
  LEFT JOIN document_text dt ON dt.document_id = d.id
  WHERE dt.document_id IS NULL
`
  )
  .all() as { id: number; filepath: string; document_id: string }[];

console.log(`Extracting text from ${documents.length} documents...\n`);

let success = 0;
let failed = 0;

for (const doc of documents) {
  const fullPath = path.join(ROOT, doc.filepath);

  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP: ${doc.document_id} — file not found`);
    failed++;
    continue;
  }

  try {
    const buffer = fs.readFileSync(fullPath);
    const data = await pdfParse(buffer);
    const text = data.text.trim();

    if (text.length > 0) {
      insertText.run(doc.id, text);
      success++;
    } else {
      console.log(`  EMPTY: ${doc.document_id} — no text content`);
      failed++;
    }

    if ((success + failed) % 50 === 0) {
      console.log(`  Progress: ${success + failed}/${documents.length}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ERROR: ${doc.document_id} — ${msg}`);
    failed++;
  }
}

console.log(`\nExtraction complete:`);
console.log(`  Success: ${success}`);
console.log(`  Failed: ${failed}`);

db.close();

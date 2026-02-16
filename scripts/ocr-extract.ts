/**
 * OCR extraction for scanned PDFs that pdf-parse couldn't handle.
 * Uses pdftoppm + tesseract (both must be installed via Homebrew).
 * Run: npx tsx scripts/ocr-extract.ts
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const insertText = db.prepare(
  "INSERT OR REPLACE INTO document_text (document_id, content) VALUES (?, ?)"
);

const documents = db
  .prepare(
    `
  SELECT d.id, d.filepath, d.document_id, d.filename
  FROM documents d
  LEFT JOIN document_text dt ON dt.document_id = d.id
  WHERE dt.document_id IS NULL
`
  )
  .all() as { id: number; filepath: string; document_id: string; filename: string }[];

console.log(`OCR processing ${documents.length} documents...\n`);

const tmpDir = path.join(os.tmpdir(), "miagent-ocr");
fs.mkdirSync(tmpDir, { recursive: true });

let success = 0;
let failed = 0;
let skipped = 0;

for (const doc of documents) {
  const fullPath = path.join(ROOT, doc.filepath);

  if (!doc.filepath.endsWith(".pdf")) {
    console.log(`  SKIP: ${doc.document_id} — not a PDF`);
    skipped++;
    continue;
  }

  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP: ${doc.document_id} — file not found`);
    skipped++;
    continue;
  }

  const docTmpDir = path.join(tmpDir, String(doc.id));
  fs.mkdirSync(docTmpDir, { recursive: true });

  try {
    execSync(
      `pdftoppm -png -r 300 "${fullPath}" "${path.join(docTmpDir, "page")}"`,
      { timeout: 120000, stdio: "pipe" }
    );

    const pageFiles = fs
      .readdirSync(docTmpDir)
      .filter((f) => f.endsWith(".png"))
      .sort();

    if (pageFiles.length === 0) {
      console.log(
        `  EMPTY: ${doc.document_id} — pdftoppm produced no images`
      );
      failed++;
      continue;
    }

    let fullText = "";
    for (const pageFile of pageFiles) {
      const imgPath = path.join(docTmpDir, pageFile);
      try {
        const pageText = execSync(
          `tesseract "${imgPath}" stdout -l eng --psm 6 2>/dev/null`,
          { timeout: 60000, encoding: "utf-8" }
        );
        fullText += pageText + "\n";
      } catch {
        // Individual page OCR failure — continue with other pages
      }
    }

    const text = fullText.trim();

    if (text.length > 20) {
      insertText.run(doc.id, text);
      success++;
      console.log(
        `  OK: ${doc.document_id} — ${pageFiles.length} pages, ${text.length} chars`
      );
    } else {
      console.log(
        `  EMPTY: ${doc.document_id} — OCR produced no usable text`
      );
      failed++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    console.log(`  ERROR: ${doc.document_id} — ${msg}`);
    failed++;
  } finally {
    fs.rmSync(docTmpDir, { recursive: true, force: true });
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\nOCR extraction complete:`);
console.log(`  Success: ${success}`);
console.log(`  Failed: ${failed}`);
console.log(`  Skipped: ${skipped}`);

db.close();

/**
 * Chunk extracted text and generate embeddings for vector search.
 * Uses OpenAI text-embedding-3-small (1536 dims).
 *
 * Usage:
 *   npm run embed                  # process all documents with extracted text
 *   npm run embed -- --doc 577     # process a single document by ID
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import * as lancedb from "@lancedb/lancedb";
import { embedBatch } from "../server/lib/embeddings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "db", "miagent.db");

// Parse CLI args
const args = process.argv.slice(2);
const docFlagIdx = args.indexOf("--doc");
const singleDocId = docFlagIdx !== -1 ? Number(args[docFlagIdx + 1]) : null;

if (singleDocId !== null && isNaN(singleDocId)) {
  console.error("Invalid --doc value. Usage: npm run embed -- --doc 577");
  process.exit(1);
}

// Verify OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required.");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Get document IDs to process
let docIds: Array<{ id: number }>;

if (singleDocId !== null) {
  const exists = db
    .prepare(
      `SELECT d.id FROM documents d
       JOIN document_text dt ON dt.document_id = d.id
       WHERE d.id = ? AND dt.content IS NOT NULL AND dt.content != ''`
    )
    .get(singleDocId) as { id: number } | undefined;

  if (!exists) {
    console.error(`Document ${singleDocId} not found or has no extracted text.`);
    process.exit(1);
  }
  docIds = [exists];
  console.log(`Processing single document: ${singleDocId}`);
} else {
  docIds = db
    .prepare(
      `SELECT d.id FROM documents d
       JOIN document_text dt ON dt.document_id = d.id
       WHERE dt.content IS NOT NULL AND dt.content != ''`
    )
    .all() as Array<{ id: number }>;
  console.log(`Processing ${docIds.length} documents...`);
}

const CHARS_PER_CHUNK = 2000; // ~500 tokens
const OVERLAP_CHARS = 400; // ~100 tokens
const EMBED_BATCH_SIZE = 50; // OpenAI handles larger batches efficiently

interface ChunkRecord {
  vector: number[];
  document_id: number;
  document_ref: string;
  title: string;
  collection_id: string;
  chunk_index: number;
  text: string;
}

const lanceDbPath = path.join(ROOT, "db", "lance");
const lanceDb = await lancedb.connect(lanceDbPath);

// Check if table already exists
let tableExists = false;
try {
  await lanceDb.openTable("chunks");
  tableExists = true;
} catch {
  // Table doesn't exist yet
}

const getDoc = db.prepare(
  `SELECT d.id, d.document_id, d.title, d.collection_id, dt.content
   FROM documents d
   JOIN document_text dt ON dt.document_id = d.id
   WHERE d.id = ?`
);

let totalChunks = 0;

for (const { id } of docIds) {
  const doc = getDoc.get(id) as {
    id: number;
    document_id: string;
    title: string;
    collection_id: string;
    content: string;
  } | undefined;

  if (!doc) continue;

  console.log(`\n📄 Document ${doc.id} — ${doc.title} (${doc.content.length.toLocaleString()} chars)`);

  // If appending to existing table, remove old chunks for this document first
  if (tableExists) {
    try {
      const tbl = await lanceDb.openTable("chunks");
      await tbl.delete(`document_id = ${doc.id}`);
    } catch {
      // Ignore delete errors
    }
  }

  // Process in streaming sub-batches to avoid OOM on large documents.
  // Chunk FLUSH_SIZE texts at a time, embed them, write to LanceDB, then discard.
  const FLUSH_SIZE = 50;
  const text = doc.content;
  let start = 0;
  let chunkIndex = 0;
  let batch: ChunkRecord[] = [];
  let docChunks = 0;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    const texts = batch.map((c) => c.text);
    const vectors = await embedBatch(texts);
    if (!vectors) {
      console.error("  Embedding failed — check OPENAI_API_KEY");
      process.exit(1);
    }
    for (let j = 0; j < batch.length; j++) {
      batch[j].vector = vectors[j];
    }
    if (!tableExists) {
      await lanceDb.createTable("chunks", batch);
      tableExists = true;
    } else {
      const tbl = await lanceDb.openTable("chunks");
      await tbl.add(batch);
    }
    docChunks += batch.length;
    totalChunks += batch.length;
    console.log(`  Embedded & stored ${docChunks} chunks so far...`);
    batch = [];
  };

  while (start < text.length) {
    const end = Math.min(start + CHARS_PER_CHUNK, text.length);
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 20) {
      batch.push({
        vector: [],
        document_id: doc.id,
        document_ref: doc.document_id,
        title: doc.title,
        collection_id: doc.collection_id,
        chunk_index: chunkIndex,
        text: chunkText,
      });
      chunkIndex++;

      if (batch.length >= FLUSH_SIZE) {
        await flushBatch();
      }
    }

    if (end >= text.length) break; // reached end of document
    start = end - OVERLAP_CHARS;
  }

  // Flush remaining
  await flushBatch();
  console.log(`  Total: ${docChunks} chunks`);
}

console.log(`\nDone — ${totalChunks} chunks embedded and stored in LanceDB.`);
db.close();

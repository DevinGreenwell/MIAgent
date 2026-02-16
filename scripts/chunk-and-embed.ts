/**
 * Chunk extracted text and generate embeddings for vector search.
 * Processes documents in batches to avoid memory issues.
 * Run: npm run embed
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "@huggingface/transformers";
import * as lancedb from "@lancedb/lancedb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

console.log("Loading embedding model...");
const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
  { dtype: "q8" }
);
console.log("Model loaded.\n");

// Get document IDs with extracted text
const docIds = db
  .prepare(
    `SELECT d.id FROM documents d
     JOIN document_text dt ON dt.document_id = d.id
     WHERE dt.content IS NOT NULL AND dt.content != ''`
  )
  .all() as Array<{ id: number }>;

console.log(`Processing ${docIds.length} documents...\n`);

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const CHARS_PER_CHUNK = CHUNK_SIZE * 4;
const OVERLAP_CHARS = CHUNK_OVERLAP * 4;
const EMBED_BATCH_SIZE = 8;
const DOC_BATCH_SIZE = 20;

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

try {
  await lanceDb.dropTable("chunks");
} catch {
  // Table may not exist
}

let totalChunks = 0;
let tableCreated = false;

const getDoc = db.prepare(
  `SELECT d.id, d.document_id, d.title, d.collection_id, dt.content
   FROM documents d
   JOIN document_text dt ON dt.document_id = d.id
   WHERE d.id = ?`
);

for (let batchStart = 0; batchStart < docIds.length; batchStart += DOC_BATCH_SIZE) {
  const batchDocIds = docIds.slice(batchStart, batchStart + DOC_BATCH_SIZE);
  const records: ChunkRecord[] = [];

  // Chunk this batch of documents
  for (const { id } of batchDocIds) {
    const doc = getDoc.get(id) as {
      id: number;
      document_id: string;
      title: string;
      collection_id: string;
      content: string;
    } | undefined;

    if (!doc) continue;

    const text = doc.content;
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      const end = Math.min(start + CHARS_PER_CHUNK, text.length);
      const chunkText = text.slice(start, end).trim();

      if (chunkText.length > 20) {
        records.push({
          vector: [], // placeholder
          document_id: doc.id,
          document_ref: doc.document_id,
          title: doc.title,
          collection_id: doc.collection_id,
          chunk_index: chunkIndex,
          text: chunkText.slice(0, 1000),
        });
        chunkIndex++;
      }

      start = end - OVERLAP_CHARS;
      if (start >= text.length - 50) break;
    }
  }

  // Generate embeddings for this batch of chunks
  for (let i = 0; i < records.length; i += EMBED_BATCH_SIZE) {
    const batch = records.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map((c) => c.text.slice(0, 512));
    const output = await embedder(texts, { pooling: "mean", normalize: true });

    for (let j = 0; j < batch.length; j++) {
      batch[j].vector = Array.from(output[j].data as Float32Array);
    }
  }

  // Write to LanceDB
  if (records.length > 0) {
    if (!tableCreated) {
      await lanceDb.createTable("chunks", records);
      tableCreated = true;
    } else {
      const table = await lanceDb.openTable("chunks");
      await table.add(records);
    }
    totalChunks += records.length;
  }

  console.log(
    `  Batch ${Math.floor(batchStart / DOC_BATCH_SIZE) + 1}/${Math.ceil(docIds.length / DOC_BATCH_SIZE)}: ${records.length} chunks (total: ${totalChunks})`
  );
}

console.log(`\nStored ${totalChunks} chunk embeddings in LanceDB.`);
db.close();

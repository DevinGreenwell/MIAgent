/** LanceDB vector store for chunk similarity search. */
import * as lancedb from "@lancedb/lancedb";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANCE_PATH = path.join(__dirname, "..", "..", "db", "lance");

export interface ChunkResult {
  text: string;
  document_id: number;
  document_ref: string;
  title: string;
  collection_id: string;
  chunk_index: number;
  _distance: number;
}

let db: lancedb.Connection | null = null;
let table: lancedb.Table | null = null;
let unavailable = false;

async function getTable(): Promise<lancedb.Table | null> {
  if (unavailable) return null;
  if (table) return table;

  try {
    db = await lancedb.connect(LANCE_PATH);
    table = await db.openTable("chunks");
    return table;
  } catch (err) {
    console.warn("LanceDB unavailable:", err);
    unavailable = true;
    return null;
  }
}

/** Vector similarity search against embedded chunks. */
export async function searchChunks(
  queryVector: number[],
  limit = 10
): Promise<ChunkResult[]> {
  const tbl = await getTable();
  if (!tbl) return [];

  try {
    const results = await tbl
      .vectorSearch(queryVector)
      .limit(limit)
      .toArray();

    return results.map((r) => ({
      text: r.text as string,
      document_id: r.document_id as number,
      document_ref: r.document_ref as string,
      title: r.title as string,
      collection_id: r.collection_id as string,
      chunk_index: r.chunk_index as number,
      _distance: r._distance as number,
    }));
  } catch (err) {
    console.warn("Vector search failed:", err);
    return [];
  }
}

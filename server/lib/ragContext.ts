/** Shared RAG context gathering (vector + FTS hybrid search). */
import db from "../db.js";
import { embedText } from "./embeddings.js";
import { searchChunks, type ChunkResult } from "./vectorStore.js";

export interface RagSource {
  id: number;
  document_id: string;
  title: string;
  collection_id: string;
}

export interface RagOptions {
  /** Max approximate tokens of context to include (default: 4000) */
  tokenBudget?: number;
  /** Max vector search results to retrieve (default: 10) */
  vectorLimit?: number;
  /** Max FTS results to retrieve (default: 5) */
  ftsLimit?: number;
  /** Filter vector results to these collections */
  collections?: string[];
  /** Filter results to these document IDs */
  documentIdFilter?: Set<string>;
  /** Minimum word length for FTS terms (default: 1) */
  minWordLength?: number;
  /** Maximum number of FTS search terms (default: 5) */
  maxSearchTerms?: number;
}

export interface RagResult {
  ragContext: string;
  sources: RagSource[];
}

/**
 * Gather hybrid RAG context (vector + FTS) for a query string.
 * Configurable via options for different use cases (chat vs study).
 */
export async function gatherRagContext(
  query: string,
  options: RagOptions = {},
): Promise<RagResult> {
  const {
    tokenBudget = 4000,
    vectorLimit = 10,
    ftsLimit = 5,
    collections,
    documentIdFilter,
    minWordLength = 1,
    maxSearchTerms = 5,
  } = options;

  let ragContext = "";
  const sources: RagSource[] = [];
  const seenDocIds = new Set<number>();

  // 1. Vector search (semantic)
  let vectorChunks: ChunkResult[] = [];
  try {
    const queryVector = await embedText(query);
    if (queryVector) {
      // Push filters into LanceDB query instead of post-filtering
      const whereFilters: string[] = [];
      if (collections?.length) {
        whereFilters.push(`collection_id IN (${collections.map((c) => `'${c.replace(/'/g, "''")}'`).join(",")})`);
      }
      if (documentIdFilter?.size) {
        const docIds = [...documentIdFilter].map((d) => `'${d.replace(/'/g, "''")}'`).join(",");
        whereFilters.push(`document_ref IN (${docIds})`);
      }
      const filter = whereFilters.length ? whereFilters.join(" AND ") : undefined;
      vectorChunks = await searchChunks(queryVector, vectorLimit, filter);
    }
  } catch (err) {
    console.warn("Vector search failed, falling through to FTS:", err);
  }

  if (vectorChunks.length > 0) {
    let budget = tokenBudget;
    for (const chunk of vectorChunks) {
      if (budget <= 0) break;
      const chunkTokens = Math.ceil(chunk.text.length / 4);
      ragContext += `\n\n--- ${chunk.document_ref} (${chunk.title}) [chunk ${chunk.chunk_index}] ---\n${chunk.text}`;
      budget -= chunkTokens;

      if (!seenDocIds.has(chunk.document_id)) {
        seenDocIds.add(chunk.document_id);
        sources.push({
          id: chunk.document_id,
          document_id: chunk.document_ref,
          title: chunk.title,
          collection_id: chunk.collection_id,
        });
      }
    }
  }

  // 2. FTS search (keyword — supplements vector results)
  try {
    const searchTerms = query
      .split(/\s+/)
      .filter((w) => w.length >= minWordLength)
      .slice(0, maxSearchTerms)
      .map((w) => `"${w.replace(/"/g, "")}"`)
      .join(" OR ");

    if (searchTerms) {
      let ftsQuery: string;
      const ftsParams: unknown[] = [searchTerms];

      if (collections) {
        const collPlaceholders = collections.map(() => "?").join(",");
        ftsQuery = `
          SELECT d.id, d.document_id, d.title, d.collection_id, SUBSTR(dt.content, 1, 500) as content
          FROM documents d
          LEFT JOIN document_text dt ON dt.document_id = d.id
          JOIN documents_fts fts ON fts.rowid = d.id
          WHERE documents_fts MATCH ?
            AND d.collection_id IN (${collPlaceholders})
          ORDER BY rank
          LIMIT ?
        `;
        ftsParams.push(...collections, ftsLimit);
      } else {
        ftsQuery = `
          SELECT d.id, d.document_id, d.title, d.collection_id, SUBSTR(dt.content, 1, 500) as content
          FROM documents d
          LEFT JOIN document_text dt ON dt.document_id = d.id
          JOIN documents_fts fts ON fts.rowid = d.id
          WHERE documents_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `;
        ftsParams.push(ftsLimit);
      }

      const ftsResults = db.prepare(ftsQuery).all(...ftsParams) as Array<{
        id: number;
        document_id: string;
        title: string;
        collection_id: string;
        content: string | null;
      }>;

      const filtered = documentIdFilter
        ? ftsResults.filter((doc) => documentIdFilter.has(doc.document_id))
        : ftsResults;

      for (const doc of filtered) {
        if (seenDocIds.has(doc.id)) continue;
        seenDocIds.add(doc.id);

        sources.push({
          id: doc.id,
          document_id: doc.document_id,
          title: doc.title,
          collection_id: doc.collection_id,
        });

        if (vectorChunks.length === 0 && doc.content) {
          ragContext += `\n\n--- Document: ${doc.document_id} (${doc.title}) ---\n${doc.content.slice(0, 500)}`;
        }
      }
    }
  } catch (err) {
    console.warn("FTS search failed:", err);
  }

  return { ragContext, sources };
}

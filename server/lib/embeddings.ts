/** OpenAI embedding utility for vector search. */
import OpenAI from "openai";

const MODEL = "text-embedding-3-small"; // 1536 dimensions
const BATCH_LIMIT = 100; // OpenAI max per request
const MAX_RETRIES = 5;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        const wait = Math.pow(2, attempt) * 500 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (client) return client;
  if (!process.env.OPENAI_API_KEY) return null;
  client = new OpenAI();
  return client;
}

// Simple TTL cache for query embeddings to avoid re-embedding identical queries
const EMBED_CACHE = new Map<string, { vector: number[]; expiry: number }>();
const CACHE_TTL = 5 * 60_000; // 5 minutes
const CACHE_MAX = 100;

/** Embed a single string. Returns null if API key not configured. */
export async function embedText(text: string): Promise<number[] | null> {
  const ai = getClient();
  if (!ai) return null;

  const cached = EMBED_CACHE.get(text);
  if (cached && cached.expiry > Date.now()) {
    return cached.vector;
  }

  const res = await withRetry(() =>
    ai.embeddings.create({ model: MODEL, input: text })
  );
  const vector = res.data[0].embedding;

  // Evict oldest entry if cache is full
  if (EMBED_CACHE.size >= CACHE_MAX) {
    const firstKey = EMBED_CACHE.keys().next().value!;
    EMBED_CACHE.delete(firstKey);
  }
  EMBED_CACHE.set(text, { vector, expiry: Date.now() + CACHE_TTL });

  return vector;
}

/** Embed multiple strings. Returns null if API key not configured. */
export async function embedBatch(texts: string[]): Promise<number[][] | null> {
  const ai = getClient();
  if (!ai) return null;

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    const res = await withRetry(() =>
      ai.embeddings.create({ model: MODEL, input: batch })
    );
    for (const item of res.data) {
      results.push(item.embedding);
    }
  }

  return results;
}

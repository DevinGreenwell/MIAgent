/** OpenAI embedding utility for vector search. */
import OpenAI from "openai";

const MODEL = "text-embedding-3-small"; // 1536 dimensions
const BATCH_LIMIT = 100; // OpenAI max per request
const MAX_RETRIES = 5;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.status === 429 && attempt < MAX_RETRIES - 1) {
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

/** Embed a single string. Returns null if API key not configured. */
export async function embedText(text: string): Promise<number[] | null> {
  const ai = getClient();
  if (!ai) return null;

  const res = await withRetry(() =>
    ai.embeddings.create({ model: MODEL, input: text })
  );
  return res.data[0].embedding;
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

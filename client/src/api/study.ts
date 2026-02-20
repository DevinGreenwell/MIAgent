/** Study API — streaming study content generation and history management. */

import { parseSSEStream } from "./sse";
import type {
  StudyMetadata,
  StudyGenerateRequest,
  StudyReference,
  StudyHistoryItem,
  StudyHistoryDetail,
} from "../types/study";

export type { StudyMetadata, StudyGenerateRequest, StudyReference, StudyHistoryItem, StudyHistoryDetail };

const BASE = "/api/v1";

/**
 * Stream study content generation via SSE.
 * Mirrors the chat streaming pattern exactly.
 */
export async function streamStudyContent(
  req: StudyGenerateRequest,
  callbacks: {
    onMeta: (meta: StudyMetadata) => void;
    onChunk: (text: string) => void;
    onDone: (result: { id: number | null }) => void;
    onError: (err: Error) => void;
  },
): Promise<void> {
  const res = await fetch(`${BASE}/study/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    callbacks.onError(new Error(errorBody.error || `Study error: ${res.status}`));
    return;
  }

  const contentType = res.headers.get("content-type") || "";

  // Non-streaming fallback
  if (contentType.includes("application/json")) {
    const json = await res.json();
    if (json.error) {
      callbacks.onError(new Error(json.error));
      return;
    }
    callbacks.onMeta({ qualId: req.qualId, contentType: req.contentType });
    callbacks.onChunk(JSON.stringify(json.data));
    callbacks.onDone({ id: null });
    return;
  }

  // SSE stream
  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
    return;
  }

  let doneReceived = false;

  await parseSSEStream(reader, {
    metadata: (data) => {
      try { callbacks.onMeta(JSON.parse(data)); } catch { /* ignore */ }
    },
    text: (data) => {
      try { callbacks.onChunk(JSON.parse(data)); } catch { callbacks.onChunk(data); }
    },
    done: (data) => {
      doneReceived = true;
      let result = { id: null as number | null };
      try { result = JSON.parse(data); } catch { /* ignore */ }
      callbacks.onDone(result);
    },
  });

  if (!doneReceived) {
    callbacks.onDone({ id: null });
  }
}

/** Fetch all study history items (metadata only, no content blobs). */
export async function fetchStudyHistory(): Promise<{ data: StudyHistoryItem[] }> {
  const res = await fetch(`${BASE}/study/history`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** Fetch a single history item with full content. */
export async function fetchStudyHistoryItem(id: number): Promise<{ data: StudyHistoryDetail }> {
  const res = await fetch(`${BASE}/study/history/${id}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** Delete a history item. */
export async function deleteStudyHistoryItem(id: number): Promise<void> {
  const res = await fetch(`${BASE}/study/history/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

/** Fetch reference documents for a qualification. */
export async function fetchStudyReferences(qualId: string): Promise<{ data: StudyReference[] }> {
  const res = await fetch(`${BASE}/study/references?qualId=${encodeURIComponent(qualId)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

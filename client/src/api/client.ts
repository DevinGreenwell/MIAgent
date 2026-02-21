/**
 * Generic API client for all fetch operations
 * Handles authentication, errors, and URL construction
 */

import type {
  Collection,
  Topic,
  VesselType,
  CfrSection,
  Document,
  DocumentDetail,
  PaginatedResponse,
  ApiResponse,
  SearchParams,
} from "../types/api";

const BASE = "/api/v1";

/**
 * Generic GET request handler
 */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * Generic POST request handler
 */
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/**
 * Fetch all collections
 */
export const fetchCollections = () => get<ApiResponse<Collection[]>>("/collections");

/**
 * Fetch all topics
 */
export const fetchTopics = () => get<ApiResponse<Topic[]>>("/topics");

/**
 * Fetch all vessel types
 */
export const fetchVesselTypes = () => get<ApiResponse<VesselType[]>>("/vessel-types");

/**
 * Fetch all CFR sections
 */
export const fetchCfrSections = () => get<ApiResponse<CfrSection[]>>("/cfr-sections");

/**
 * Fetch documents with pagination and filtering
 * @param params - Search parameters including page, limit, collection, topic, vessel
 */
export const fetchDocuments = (params: SearchParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.collection) qs.set("collection", params.collection);
  if (params.topic) qs.set("topic", params.topic);
  if (params.vessel) qs.set("vessel", params.vessel);
  return get<PaginatedResponse<Document>>(`/documents?${qs}`);
};

/**
 * Fetch document details by ID
 * @param id - Document ID
 */
export const fetchDocument = (id: number) => get<ApiResponse<DocumentDetail>>(`/documents/${id}`);

/**
 * Get PDF URL for a document
 * @param id - Document ID
 */
export const getPdfUrl = (id: number) => `${BASE}/documents/${id}/pdf`;

/**
 * Search documents with full-text search
 * @param params - Search parameters including query string, page, limit, filters
 */
export const fetchSearch = (params: SearchParams = {}) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.collection) qs.set("collection", params.collection);
  if (params.topic) qs.set("topic", params.topic);
  return get<PaginatedResponse<Document>>(`/search?${qs}`);
};

/**
 * Fetch coverage statistics, optionally filtered by topic
 * @param topic - Optional topic slug to filter by
 */
export const fetchCoverage = (topic?: string) => {
  const qs = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return get<ApiResponse<Array<{ id: string; name: string; doc_count: number }>>>(`/coverage${qs}`);
};

/**
 * Fetch overall statistics
 */
export const fetchStats = () =>
  get<ApiResponse<{ documents: number; collections: number; topics: number }>>("/stats");

/**
 * Check API health
 */
export const fetchHealth = () => get<ApiResponse<{ status: string }>>("/health");

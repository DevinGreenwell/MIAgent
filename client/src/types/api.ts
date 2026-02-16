/**
 * Core API types for MIAgent
 * Shared types for all document and metadata API responses
 */

export interface Document {
  id: number;
  document_id: string;
  title: string;
  filename: string;
  collection_id: string;
  subcategory: string | null;
  year: number | null;
  status: string | null;
  part_title?: string | null;
}

export interface DocumentDetail extends Document {
  filepath: string;
  revision: string | null;
  topics: Array<{ id: number; name: string; slug: string }>;
  vessel_types: Array<{ id: number; name: string; slug: string }>;
  cfr_sections: Array<{ id: number; label: string; title: string; part: string; subpart: string }>;
  related: Array<{ id: number; document_id: string; title: string; relationship_type: string }>;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  doc_count: number;
}

export interface Topic {
  id: number;
  name: string;
  slug: string;
  doc_count: number;
}

export interface VesselType {
  id: number;
  name: string;
  slug: string;
  doc_count: number;
}

export interface CfrSection {
  id: number;
  label: string;
  title: string;
  part: string;
  subpart: string;
}

export interface DocumentFilters {
  collection?: string;
  topic?: string;
  vessel?: string;
  [key: string]: string | number | undefined;
}

export interface SearchParams extends DocumentFilters {
  q?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pages: number;
    total: number;
    limit: number;
  };
}

export interface ApiResponse<T> {
  data: T;
}

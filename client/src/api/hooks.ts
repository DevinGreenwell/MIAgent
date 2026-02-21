/**
 * React Query hooks for document queries
 * Provides cached, reusable query hooks for all document API endpoints
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchCollections,
  fetchTopics,
  fetchVesselTypes,
  fetchDocuments,
  fetchSearch,
  fetchDocument,
  fetchStats,
} from "./client";
import type { SearchParams } from "../types/api";

/**
 * Hook to fetch all collections
 * Stale time: Infinity (collections rarely change)
 */
export const useCollections = () =>
  useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    staleTime: Infinity,
  });

/**
 * Hook to fetch all topics
 * Stale time: Infinity (topics rarely change)
 */
export const useTopics = () =>
  useQuery({
    queryKey: ["topics"],
    queryFn: fetchTopics,
    staleTime: Infinity,
  });

/**
 * Hook to fetch all vessel types
 * Stale time: Infinity (vessel types rarely change)
 */
export const useVesselTypes = () =>
  useQuery({
    queryKey: ["vessel-types"],
    queryFn: fetchVesselTypes,
    staleTime: Infinity,
  });

/**
 * Hook to fetch paginated documents with filters
 * Uses keepPreviousData to maintain UI while loading new pages
 * @param params - Search parameters for filtering and pagination
 */
export const useDocuments = (params: SearchParams) =>
  useQuery({
    queryKey: ["documents", params],
    queryFn: () => fetchDocuments(params),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

/**
 * Hook for full-text search
 * Only enabled when query string is present
 * Uses keepPreviousData to maintain UI while loading results
 * @param params - Search parameters including query string
 */
export const useSearch = (params: SearchParams) =>
  useQuery({
    queryKey: ["search", params],
    queryFn: () => fetchSearch(params),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    enabled: !!params.q,
  });

/**
 * Hook to fetch detailed document information
 * Only enabled when ID is provided
 * @param id - Document ID (null to disable query)
 */
export const useDocument = (id: number | null) =>
  useQuery({
    queryKey: ["document", id],
    queryFn: () => fetchDocument(id!),
    staleTime: 10 * 60_000,
    enabled: id !== null,
  });

/**
 * Hook to fetch statistics
 */
export const useStats = () =>
  useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 5 * 60_000,
  });

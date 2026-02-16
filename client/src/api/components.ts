/**
 * Component API and hooks for 3D engine room viewer
 * Handles systems, components, and deficiency data
 */

import { useQuery } from "@tanstack/react-query";
import type { System, Component, ComponentDetail } from "../types/components";
import type { ApiResponse } from "../types/api";

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
 * Fetch all engine room systems
 */
export const fetchSystems = () => get<ApiResponse<System[]>>("/systems");

/**
 * Fetch components, optionally filtered by system
 * @param system - Optional system ID to filter by
 */
export const fetchComponents = (system?: number) => {
  const qs = system ? `?system=${system}` : "";
  return get<ApiResponse<Component[]>>(`/components${qs}`);
};

/**
 * Fetch detailed component information by ID or mesh name
 * @param idOrMesh - Component ID (number) or mesh name (string)
 */
export const fetchComponent = (idOrMesh: string | number) =>
  get<ApiResponse<ComponentDetail>>(`/components/${idOrMesh}`);

/**
 * Hook to fetch all systems
 * Stale time: Infinity (systems rarely change)
 */
export const useSystems = () =>
  useQuery({
    queryKey: ["systems"],
    queryFn: fetchSystems,
    staleTime: Infinity,
  });

/**
 * Hook to fetch components, optionally filtered by system
 * @param system - Optional system ID to filter by
 */
export const useComponents = (system?: number) =>
  useQuery({
    queryKey: ["components", system],
    queryFn: () => fetchComponents(system),
  });

/**
 * Hook to fetch detailed component information
 * Only enabled when ID/mesh name is provided
 * @param idOrMesh - Component ID/mesh name (null to disable query)
 */
export const useComponent = (idOrMesh: string | number | null) =>
  useQuery({
    queryKey: ["component", idOrMesh],
    queryFn: () => fetchComponent(idOrMesh!),
    enabled: idOrMesh !== null,
  });

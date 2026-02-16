/**
 * 3D Component types for MIAgent
 * Types for engine room systems and components with deficiency tracking
 */

export interface System {
  id: number;
  name: string;
  color: string;
  component_count: number;
}

export interface Component {
  id: number;
  mesh_name: string;
  display_name: string;
  description: string;
  system_id: number;
  system_name: string;
  system_color: string;
}

export interface ComponentDocument {
  id: number;
  document_id: string;
  title: string;
  collection_id: string;
  year: number | null;
  relevance: string;
  cfr_reference: string | null;
}

export interface ComponentDeficiency {
  id: number;
  code: string;
  title: string;
  description: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  cfr_reference: string | null;
  remediation: string;
}

export interface ComponentDetail extends Component {
  inspection_notes: string;
  documents: ComponentDocument[];
  deficiencies: ComponentDeficiency[];
}

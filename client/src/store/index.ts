import { create } from "zustand";

type ActiveView = "chat" | "search" | "viewer" | "study";
type ViewerMode = "orbit" | "inspect";

interface AppState {
  // View toggle
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filters: { collection?: string; topic?: string; vessel?: string };
  setFilter: (key: "collection" | "topic" | "vessel", value: string | undefined) => void;
  clearFilters: () => void;
  page: number;
  setPage: (p: number) => void;

  // Document viewing
  selectedDocumentId: number | null;
  setSelectedDocumentId: (id: number | null) => void;

  // PDF viewer
  pdfOpen: boolean;
  setPdfOpen: (open: boolean) => void;

  // 3D Viewer
  selectedComponent: string | null;
  setSelectedComponent: (mesh: string | null) => void;
  highlightedComponents: string[];
  setHighlightedComponents: (meshes: string[]) => void;
  viewerMode: ViewerMode;
  setViewerMode: (mode: ViewerMode) => void;
  selectedSystem: number | null;
  setSelectedSystem: (id: number | null) => void;
  selectedSubComponent: string | null;
  setSelectedSubComponent: (name: string | null) => void;

  // Chat
  chatSessionId: string | null;
  setChatSessionId: (id: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  activeView: "chat",
  setActiveView: (activeView) => set({ activeView }),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery, page: 1 }),
  filters: {},
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value || undefined },
      page: 1,
    })),
  clearFilters: () => set({ filters: {}, page: 1 }),
  page: 1,
  setPage: (page) => set({ page }),

  selectedDocumentId: null,
  setSelectedDocumentId: (selectedDocumentId) => set({ selectedDocumentId }),

  pdfOpen: false,
  setPdfOpen: (pdfOpen) => set({ pdfOpen }),

  selectedComponent: null,
  setSelectedComponent: (selectedComponent) => set({ selectedComponent, selectedSubComponent: null }),
  highlightedComponents: [],
  setHighlightedComponents: (highlightedComponents) => set({ highlightedComponents }),
  viewerMode: "orbit",
  setViewerMode: (viewerMode) => set({ viewerMode }),
  selectedSystem: null,
  setSelectedSystem: (selectedSystem) => set({ selectedSystem }),
  selectedSubComponent: null,
  setSelectedSubComponent: (selectedSubComponent) => set({ selectedSubComponent }),

  chatSessionId: null,
  setChatSessionId: (chatSessionId) => set({ chatSessionId }),
}));

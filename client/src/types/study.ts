/** Study feature types shared across components and API layer. */

export interface StudyMetadata {
  qualId: string;
  contentType: string;
  sources?: Array<{ id: number; document_id: string; title: string; collection_id: string }>;
  cached?: boolean;
}

export interface StudyGenerateRequest {
  qualId: string;
  contentType: string;
  topic?: string;
  documentIds?: string[];
}

export interface StudyReference {
  id: number;
  document_id: string;
  title: string;
  collection_id: string;
  year: number | null;
  summary: string | null;
}

export interface StudyHistoryItem {
  id: number;
  qual_id: string;
  content_type: string;
  topic: string | null;
  created_at: string;
}

export interface StudyHistoryDetail extends StudyHistoryItem {
  content: string;
}

// Study content item types for parsed content renderers

export interface FlashcardItem {
  front: string;
  back: string;
  citation?: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  citation?: string;
}

export interface ScenarioItem {
  title: string;
  situation: string;
  expectedActions: string[];
  keyRegs: string[];
}

export interface SlideshowItem {
  title: string;
  bullets: string[];
  speakerNotes?: string;
  citations?: string[];
}

export type StudyContentItem = FlashcardItem | QuizItem | ScenarioItem | SlideshowItem;

// Slideshow image generation types

export interface SlideshowItemWithImage extends SlideshowItem {
  imageUrl?: string;
  imageStatus: "pending" | "generating" | "ready" | "failed" | "skipped";
  imagePrompt?: string;
  imageError?: string;
}

export interface SlideshowSession {
  sessionId: number;
  qualId: string;
  status: "pending" | "generating_images" | "ready" | "error";
  slides: SlideshowItemWithImage[];
  imagesCompleted: number;
}

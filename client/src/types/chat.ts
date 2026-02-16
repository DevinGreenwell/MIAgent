/**
 * Chat API types for MIAgent
 * Types for AI chat sessions and message handling
 */

export interface ChatSource {
  id: number;
  document_id: string;
  title: string;
  collection_id: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  componentContext?: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  sources: ChatSource[];
  componentRefs: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  created_at?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  message_count?: number;
  messages?: ChatMessage[];
}

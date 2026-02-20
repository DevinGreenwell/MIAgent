/** Shared Anthropic client singleton and AI model config. */
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = process.env.AI_MODEL || "claude-haiku-4-5-20251001";

let anthropic: Anthropic | null = null;
try {
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic();
  } else {
    console.warn("ANTHROPIC_API_KEY not set — AI features disabled");
  }
} catch {
  console.warn("Failed to initialize Anthropic client — AI features disabled");
}

export { anthropic };

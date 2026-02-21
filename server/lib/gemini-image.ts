/** Shared Google GenAI client singleton for Nano Banana Pro image generation. */
import { GoogleGenAI } from "@google/genai";

export const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";

let genai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } else {
    console.warn(
      "GEMINI_API_KEY not set — slideshow image generation disabled",
    );
  }
} catch {
  console.warn(
    "Failed to initialize Google GenAI client — slideshow image generation disabled",
  );
}

export { genai };

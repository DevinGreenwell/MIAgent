/** Shared document formatting utilities */

export const COLLECTION_COLORS: Record<string, string> = {
  cfr: "bg-blue-900/50 text-blue-300 border-blue-800/50",
  nvic: "bg-green-900/50 text-green-300 border-green-800/50",
  "policy-letter": "bg-purple-900/50 text-purple-300 border-purple-800/50",
  prg: "bg-orange-900/50 text-orange-300 border-orange-800/50",
  mtn: "bg-teal-900/50 text-teal-300 border-teal-800/50",
  "io-guidance": "bg-pink-900/50 text-pink-300 border-pink-800/50",
  "class-rules": "bg-indigo-900/50 text-indigo-300 border-indigo-800/50",
  msm: "bg-yellow-900/50 text-yellow-300 border-yellow-800/50",
  imo: "bg-red-900/50 text-red-300 border-red-800/50",
};

/**
 * Extract the document ID portion from a full document_id path.
 * e.g., "mtn/MTN.01-19.2019.05.07.guidance-on-the..." -> "MTN.01 19.2019.05.07"
 */
export function formatDocId(documentId: string): string {
  const slug = documentId.split("/").pop() || documentId;
  const match = slug.match(/^([A-Z]{2,}[\d./-]+(?:ch[-.]?\d+\.?)?[\d.]+)/i);
  return match ? match[1].replace(/-/g, " ") : slug.replace(/-/g, " ");
}

/**
 * Strip the leading doc ID / number prefix from a title to get just the descriptive name.
 * Handles MTN, PRG, NVIC, etc. patterns like:
 *   "MTN.01 19.2019.05.07.Guidance On The..." -> "Guidance On The..."
 *   "MTN.04 03.Ch 4.2021.04.06.Technical Support..." -> "Technical Support..."
 *   "PRG.E1 02.2020.07.10.Bilge And Ballast..." -> "Bilge And Ballast..."
 */
export function formatTitle(title: string): string {
  const stripped = title
    .replace(/^[A-Z]{2,}[.\s\d/-]+(?:[Cc][Hh][.\s-]?\d+[.\s-]*)?[\d.\s-]*\.?\s*/, "")
    .trim();
  return stripped || title;
}

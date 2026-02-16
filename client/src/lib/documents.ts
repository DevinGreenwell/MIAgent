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
 * Extract a clean document number from a document_id path.
 * e.g., "mtn/MTN.01-19.2019.05.07.guidance-on-the..." -> "MTN 01-19"
 *       "mtn/MTN.04-03.ch-4.2021.04.06.technical-..." -> "MTN 04-03 Ch 4"
 *       "nvic/NVIC-02-81-ch1-integrated-tug-..."       -> "NVIC 02-81 Ch 1"
 *       "prg/PRG.E1-02.2020.07.10.bilge-..."           -> "PRG E1-02"
 */
export function formatDocId(documentId: string): string {
  const slug = documentId.split("/").pop() || documentId;

  // MTN: MTN.01-04.2004... or MTN-01-11-ch-2-...
  const mtn = slug.match(/^(MTN)[.\s-]?(\d{2})[.\s-](\d{2})(?:[.\s-]([Cc][Hh])[.\s-]?(\d+))?/i);
  if (mtn) {
    const base = mtn[1] + " " + mtn[2] + "-" + mtn[3];
    return mtn[4] ? base + " Ch " + mtn[5] : base;
  }

  // PRG: PRG.E1-02.2020...
  const prg = slug.match(/^(PRG)[.\s-]?([A-Z]\d)[.\s-](\d{2})/i);
  if (prg) return prg[1] + " " + prg[2] + "-" + prg[3];

  // NVIC: NVIC-01-04-... or NVIC-02-81-ch1-...
  const nvic = slug.match(/^(NVIC)[.\s-]?(\d{2})[.\s-](\d{2})(?:[.\s-]([Cc][Hh])(\d+))?/i);
  if (nvic) {
    const base = nvic[1] + " " + nvic[2] + "-" + nvic[3];
    return nvic[4] ? base + " Ch " + nvic[5] : base;
  }

  // Fallback: clean up separators
  return slug.replace(/[-._]/g, " ");
}

/**
 * Strip the leading doc ID / number prefix from a title to get just the descriptive name.
 * e.g., "MTN.01 19.2019.05.07.Guidance On The..." -> "Guidance On The..."
 *       "MTN.04 03.Ch 4.2021.04.06.Technical Support..." -> "Technical Support..."
 */
export function formatTitle(title: string): string {
  const stripped = title
    .replace(/^[A-Z]{2,}[.\s\d/-]+(?:[Cc][Hh][.\s-]?\d+[.\s-]*)?[\d.\s-]*\.?\s*/, "")
    .trim();
  return stripped || title;
}

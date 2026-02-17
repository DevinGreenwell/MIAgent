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
 * Examples:
 *   "mtn/MTN.01-19.2019.05.07.guidance-..."           -> "MTN 01-19"
 *   "mtn/MTN.04-03.ch-4.2021.04.06.technical-."       -> "MTN 04-03 Ch 4"
 *   "prg/PRG.solas-53.2021.11.12.regulation-..."       -> "PRG Solas-53"
 *   "prg/PRG.c1-01.2016.01.26.review-..."              -> "PRG C1-01"
 *   "prg/DVG.e1-36.2021.03.26.design-..."              -> "DVG E1-36"
 *   "nvic/NVIC-02-81-ch1-integrated-..."                -> "NVIC 02-81 Ch 1"
 *   "policy-letter/CG-CVC-pol17-05"                     -> "CG CVC Pol Ltr 17-05"
 *   "policy-letter/CG-CVC-pol13-04-ch1"                 -> "CG CVC Pol Ltr 13-04 (CH-1)"
 *   "class-rules/ABS-part1"                              -> "ABS Part 1"
 *   "class-rules/IACS47"                                 -> "IACS No. 47"
 *   "cfr/33-CFR-part160"                                  -> "33 CFR Part 160"
 *   "cfr/46-CFR-Part-10"                                  -> "46 CFR Part 10"
 */
export function formatDocId(documentId: string): string {
  const slug = documentId.split("/").pop() || documentId;

  // CFR: 33-CFR-part160 or 46-CFR-Part-10
  const cfr = slug.match(/^(\d+)-CFR-[Pp]art-?(\d+)$/);
  if (cfr) return cfr[1] + " CFR Part " + cfr[2];

  // MSM: MSM-vol2
  const msm = slug.match(/^MSM-vol(\d+)/i);
  if (msm) return "MSM Vol. " + msm[1];

  // Class Rules: ABS-partN or IACS{N}
  const absPart = slug.match(/^(ABS)-part(\d+)/i);
  if (absPart) return absPart[1].toUpperCase() + " Part " + absPart[2];
  const iacs = slug.match(/^(IACS)(\d+)/i);
  if (iacs) return iacs[1].toUpperCase() + " No. " + iacs[2];

  // Policy Letter: CG-CVC-polXX-YY or CG-CVC-polXX-YY-chN or CG-CVC-polXX-YY-revN
  const pol = slug.match(/^CG-CVC-pol(\d{2})-(\d{2})(?:-(ch)(\d+))?/i);
  if (pol) {
    const base = "CG CVC Pol Ltr " + pol[1] + "-" + pol[2];
    return pol[3] ? base + " (CH-" + pol[4] + ")" : base;
  }

  // MTN: MTN.01-04.2004... or MTN-01-11-ch-2-...
  const mtn = slug.match(/^(MTN)[.\s-]?(\d{2})[.\s-](\d{2})(?:[.\s-]([Cc][Hh])[.\s-]?(\d+))?/i);
  if (mtn) {
    const base = mtn[1].toUpperCase() + " " + mtn[2] + "-" + mtn[3];
    return mtn[4] ? base + " Ch " + mtn[5] : base;
  }

  // PRG/DVG with category prefix: PRG.solas-53, PRG.c1-01, DVG.e1-36
  const prgDvg = slug.match(/^(PRG|DVG)[.\s-]?([a-zA-Z]+\d?)[.\s-]?(\d{2})/i);
  if (prgDvg) {
    const prefix = prgDvg[1].toUpperCase();
    const cat = prgDvg[2].charAt(0).toUpperCase() + prgDvg[2].slice(1).toLowerCase();
    return prefix + " " + cat + "-" + prgDvg[3];
  }

  // NVIC: NVIC-01-04 or NVIC-02-81-ch1
  const nvic = slug.match(/^(NVIC)[.\s-]?(\d{2})[.\s-](\d{2})(?:[.\s-]([Cc][Hh])(\d+))?/i);
  if (nvic) {
    const base = nvic[1].toUpperCase() + " " + nvic[2] + "-" + nvic[3];
    return nvic[4] ? base + " Ch " + nvic[5] : base;
  }

  // Fallback: clean up separators
  return slug.replace(/[-._]/g, " ");
}

/**
 * Strip the leading doc ID / number prefix from a title to get just the descriptive name.
 * Examples:
 *   "PRG.Solas 53.2021.11.12.Regulation 38 Alt..." -> "Regulation 38 Alt..."
 *   "DVG.E1 36.2021.03.26.Design Verification..."  -> "Design Verification..."
 *   "MTN.04 03.Ch 4.2021.04.06.Technical Support." -> "Technical Support..."
 *   "33 CFR Part 160"                               -> "33 CFR Part 160" (unchanged)
 */
export function formatTitle(title: string): string {
  // PRG/DVG: PRG.Solas 53.2021.11.12.Title or DVG.E1 36.Title
  const prgDvg = title.match(/^(?:PRG|DVG)[.\s]?[A-Za-z]+\d?\s?\d{2}[.\s]?(?:\d{4}[.\s]\d{2}[.\s]\d{2}[.\s]?)?(.+)/i);
  if (prgDvg && prgDvg[1].trim().length > 1) return prgDvg[1].trim();

  // MTN: MTN.01 19.2019.05.07.Title or MTN.04 03.Ch 4.2021.04.06.Title
  const mtnMatch = title.match(/^MTN[.\s]?\d{2}[.\s]\d{2}[.\s]?(?:[Cc][Hh][.\s]?\d+[.\s]?)?(?:\d{4}[.\s]\d{2}[.\s]\d{2}[.\s]?)?(.+)/i);
  if (mtnMatch && mtnMatch[1].trim().length > 1) return mtnMatch[1].trim();

  // NVIC: NVIC 03 00 Fast Rescue Boats...
  const nvicMatch = title.match(/^NVIC[.\s-]?\d{2}[.\s-]\d{2}[.\s-]?(?:[Cc][Hh][.\s-]?\d+[.\s-]?)?(.+)/i);
  if (nvicMatch && nvicMatch[1].trim().length > 1) return nvicMatch[1].trim();

  return title;
}

/** Title-case an ALL CAPS string, preserving short words (of, and, etc.) in lowercase. */
export function titleCase(str: string): string {
  const minor = new Set(["a","an","and","at","but","by","for","in","of","on","or","the","to"]);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 || !minor.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(" ");
}

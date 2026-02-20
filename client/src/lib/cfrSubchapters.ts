/** CFR part-to-subchapter mapping for hierarchical reference grouping. */

const SUBCHAPTER_PARTS: Record<string, number[]> = {
  "D \u2014 Tank Vessels": [30, 31, 32, 33, 34, 35, 39, 40],
  "E \u2014 Load Lines": [42, 44, 45, 46],
  "F \u2014 Marine Engineering": [50, 52, 54, 56, 58],
  "G \u2014 Electrical Engineering": [61, 62, 63],
  "H \u2014 Passenger Vessels": [70, 71, 72, 76, 78],
  "I \u2014 Cargo & Misc Vessels": [90, 91, 92, 95, 97],
  "IA \u2014 MODUs": [107, 108, 109],
  "K \u2014 Small Passenger \u2265100 GT": [114, 115, 116, 117, 118, 119, 120, 121, 122],
  "L \u2014 OSVs": [125, 126, 127, 128, 129, 130, 131, 132, 133, 134],
  "O \u2014 Certain Bulk Dangerous Cargoes": [148, 150, 151, 153, 154],
  "T \u2014 Small Passenger <100 GT": [175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185],
};

/** Map from part number to subchapter label. */
export const PART_TO_SUBCHAPTER = new Map<number, string>();
for (const [subchapter, parts] of Object.entries(SUBCHAPTER_PARTS)) {
  for (const part of parts) {
    PART_TO_SUBCHAPTER.set(part, subchapter);
  }
}

/**
 * Extract a CFR part number from a document_id string.
 * Handles formats like "cfr/46-CFR-Part-175" or "cfr/33-CFR-part160".
 * Returns null for non-CFR documents.
 */
export function extractCfrPartNumber(documentId: string): number | null {
  const match = documentId.match(/\d+-CFR-[Pp]art-?(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

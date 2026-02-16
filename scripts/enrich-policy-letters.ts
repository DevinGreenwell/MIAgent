/**
 * Enrich policy letter metadata extracted from PDF content.
 * Updates: titles (actual subjects), years, vessel type associations,
 * CFR section records + associations.
 *
 * Run: npx tsx scripts/enrich-policy-letters.ts
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "db", "miagent.db");
const PDF_DIR = path.join(ROOT, "Policy Letter");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

/** Map extracted vessel type names → DB vessel_types.name */
const VESSEL_TYPE_MAP: Record<string, string> = {
  "Towing Vessels": "Towing Vessels",
  "Tank Vessels": "Tank Vessels",
  "Tank Barges": "Tank Vessels",
  "Passenger Vessels": "Passenger Vessels",
  "Small Passenger Vessels": "Small Passenger Vessels",
  "Fishing Vessels": "Commercial Fishing Vessels",
  "Cargo Vessels": "Cargo and Miscellaneous Vessels",
  "OSVs": "Offshore Supply Vessels",
  "MODUs": "Mobile Offshore Drilling Units",
  "Barges": "Uninspected Vessels",
  "Ro-Ro Vessels": "Cargo and Miscellaneous Vessels",
  "Bulk Carriers": "Cargo and Miscellaneous Vessels",
  "Container Ships": "Cargo and Miscellaneous Vessels",
  "Liftboats": "Mobile Offshore Drilling Units",
  "Motorboats": "Uninspected Vessels",
};

/** Vessel type keywords to search for in document text */
const VESSEL_KEYWORDS: Record<string, string> = {
  "towing vessel": "Towing Vessels",
  "tow vessel": "Towing Vessels",
  "tugboat": "Towing Vessels",
  "tank barge": "Tank Vessels",
  "tank vessel": "Tank Vessels",
  "tankship": "Tank Vessels",
  "passenger vessel": "Passenger Vessels",
  "passenger ship": "Passenger Vessels",
  "small passenger vessel": "Small Passenger Vessels",
  "fishing vessel": "Fishing Vessels",
  "fish processing vessel": "Fishing Vessels",
  "fish tender vessel": "Fishing Vessels",
  "cargo vessel": "Cargo Vessels",
  "cargo ship": "Cargo Vessels",
  "freight vessel": "Cargo Vessels",
  "offshore supply vessel": "OSVs",
  "crew boat": "OSVs",
  "modu": "MODUs",
  "mobile offshore drilling unit": "MODUs",
  "ro-ro": "Ro-Ro Vessels",
  "liftboat": "Liftboats",
  "motorboat": "Motorboats",
};

/** Manual subjects for PDFs where extraction failed or OCR was too garbled */
const MANUAL_SUBJECTS: Record<string, string> = {
  "CG-CVC-pol00-04-rev1":
    "Watchkeeping and Work-Hour Limitations on Towing Vessels, Offshore Supply Vessels (OSV) & Crew Boats Utilizing a Two Watch System",
  "CG-CVC-pol02-03":
    "Policy for the Enforcement of the 1995 Amendments to the International Convention on Standards of Training, Certification and Watchkeeping for Seafarers, 1978 (STCW 95) on Board U.S.-Flag Vessels",
  "CG-CVC-pol02-04":
    "Policy for the Enforcement of the 1995 Amendments to the International Convention on Standards of Training, Certification and Watchkeeping for Seafarers, 1978 (STCW 95), During Port State Control Exams",
  "CG-CVC-pol04-04":
    "Status of Fishery Observers/Agents Onboard Uninspected Passenger Vessels Engaged in Recreational Fishing with Regard to Number of Passengers Carried Onboard",
  "CG-CVC-pol09-01":
    "Guidelines for Ensuring Compliance with Annex VI to the International Convention for the Prevention of Pollution From Ships (MARPOL) 73/78; Prevention of Air Pollution From Ships",
  "CG-CVC-pol09-03":
    "Existing Alternative Fire Detection Systems for Small Passenger Vessels Utilizing DC Power",
  "CG-CVC-pol11-01":
    "Guidelines for Ensuring Compliance with the U.S. EPA's Vessel General Permit (VGP)",
  "CG-CVC-pol11-02":
    "Guidelines for Acceptance of Perko Navigational Light Fixtures on Uninspected Commercial Vessels",
  "CG-CVC-pol11-03":
    "Implementation of the Assumed Average Weight Per Person (AAWPP) for Passenger Vessels",
  "CG-CVC-pol11-04":
    "Compliance Verification of Alternative Security Programs for MTSA Regulated Vessels and Facilities",
  "CG-CVC-pol11-05":
    "Safety Requirements and Manning Exemption Eligibility on Distant Water Tuna Fleet Vessels",
  "CG-CVC-pol11-07":
    "STCW Officer in Charge of a Navigational Watch Assessment Sheets",
  "CG-CVC-pol11-09":
    "Cruise Vessel Security and Safety Act (CVSSA) of 2010 Implementation Procedures",
  "CG-CVC-pol11-15":
    "Processing of Merchant Mariner Credentials (MMC) for Mariners Not Requiring a Transportation Worker Identification Credential (TWIC)",
  "CG-CVC-pol12-02":
    "Commercial Fishing Vessel (CFV) Safety Program Management; USCG Auxiliary CFV Examiner and Dockwalking Augmentation",
  "CG-CVC-pol12-03":
    "Endorsement of Offshore Supply Vessels (OSV) as Oil Spill Response Vessels (OSRV)",
  "CG-CVC-pol13-02":
    "MARPOL Annex VI International Energy Efficiency (IEE) Certificate Implementation Guidance",
  "CG-CVC-pol15-03":
    "Crediting Recent Service of Uniformed Service Personnel",
  "CG-CVC-pol15-06-ch2":
    "VHF-DSC Radio Equipment Installation Requirement for Small Passenger and Commercial Fishing Vessels",
  "CG-CVC-pol17-08-e1":
    "MISLE Activity Format for Testing of Machinery Alarms and Shutdowns",
  "CG-CVC-pol18-04":
    "Portable Fire Extinguisher Weight-Based vs. Performance-Based Rating Crosswalk",
  "CG-CVC-pol24-01":
    "Guidance for Determining the Inspection Status of Publicly Owned Oceanographic Research Vessels (ORV)",
  "CG-CVC-pol99-02":
    "Commercial Explosives Handling; Application of Quantity/Distance Tables",
  "CG-CVC-wi-022":
    "Implementation of Compliance/Enforcement Policy for MARPOL Annex VI Regulation 14, Including IMO 2020 Sulfur Cap",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getVesselTypeId(name: string): number | null {
  const row = db
    .prepare("SELECT id FROM vessel_types WHERE name = ?")
    .get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

function getOrCreateCfrSection(label: string): number {
  const existing = db
    .prepare("SELECT id FROM cfr_sections WHERE label = ?")
    .get(label) as { id: number } | undefined;
  if (existing) return existing.id;

  // Parse "46 CFR Part 15" or "46 CFR 181.400" etc
  const m = label.match(/^(\d+)\s+CFR\s+(.+)/);
  const title = m ? `Title ${m[1]} CFR` : label;
  const part = m ? m[2].replace(/^(Part\s+)?/, "").split(".")[0] : "";

  const result = db
    .prepare(
      "INSERT INTO cfr_sections (label, title, part, subpart) VALUES (?, ?, ?, '')"
    )
    .run(label, title, part);
  return Number(result.lastInsertRowid);
}

function getPdfText(slug: string): string {
  // Walk PDF_DIR to find the file
  try {
    const find = execSync(
      `find "${PDF_DIR}" -name "${slug}.pdf" -type f 2>/dev/null`
    )
      .toString()
      .trim();
    if (!find) return "";
    const pdfPath = find.split("\n")[0];
    return execSync(`pdftotext "${pdfPath}" - 2>/dev/null`).toString();
  } catch {
    return "";
  }
}

function extractSubject(text: string): string | null {
  const patterns = [
    /Subj:\s*(.+?)(?:\n\s*\n|\nRef:|\nEncl:|\n\d+\.\s+(?:PURPOSE|ACTION|DIRECTIVES|BACKGROUND|DISCUSSION))/is,
    /Subj:\s*(.+?)(?:\nRef:|\nEncl:|\n\d+\.)/is,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let subj = m[1].replace(/\s+/g, " ").trim();
      // Remove trailing "Ref" if regex grabbed it
      subj = subj.replace(/\s*Ref\s*$/, "").trim();
      if (subj.length > 250) {
        const cut = subj.lastIndexOf(".", 250);
        subj = cut > 50 ? subj.slice(0, cut + 1) : subj.slice(0, 250);
      }
      if (subj.length > 5) return subj;
    }
  }
  return null;
}

function extractDate(text: string): string | null {
  const header = text.slice(0, 3000);
  const full =
    header.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
    ) ||
    header.match(
      /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}\s*,?\s*\d{4}/i
    );
  return full ? full[0] : null;
}

function deriveYear(docId: string): number | null {
  // Use the doc_id encoding — it's the authoritative year for policy letters
  // CG-CVC-polYY-SS where YY is the 2-digit year
  const m = docId.match(/pol(\d{2})-\d{2}/);
  if (m) {
    const yy = parseInt(m[1]);
    return yy < 50 ? 2000 + yy : 1900 + yy;
  }
  return null;
}

function extractCfrRefs(text: string): string[] {
  const refs = new Set<string>();
  const regex =
    /(\d{1,2})\s*CFR\s*(Part\s+\d+|Subchapter\s+\w+|[Ss]ection\s+\d+(?:\.\d+)?|§?\s*\d+(?:\.\d+)?(?:\([a-z0-9]\))*)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let section = match[2].replace(/\s+/g, " ").trim();
    section = section.replace(/^[Ss]ection\s+/, "");
    const ref = `${match[1]} CFR ${section}`;
    if (ref.length < 50) refs.add(ref);
  }
  return Array.from(refs).sort().slice(0, 15);
}

function extractVesselTypes(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [keyword, type] of Object.entries(VESSEL_KEYWORDS)) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`);
    if (regex.test(lower)) found.add(type);
  }
  return Array.from(found).sort();
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

console.log("Enriching policy letter metadata...\n");

// Get all policy letters with DB text
const docs = db
  .prepare(
    `SELECT d.id, d.document_id, d.title, d.subcategory, d.year,
            COALESCE(dt.content, '') as db_text
     FROM documents d
     LEFT JOIN document_text dt ON d.id = dt.document_id
     WHERE d.collection_id = 'policy-letter'
     ORDER BY d.document_id`
  )
  .all() as Array<{
  id: number;
  document_id: string;
  title: string;
  subcategory: string | null;
  year: number | null;
  db_text: string;
}>;

console.log(`Found ${docs.length} policy letters\n`);

// Prepare statements
const updateTitle = db.prepare(
  "UPDATE documents SET title = ? WHERE id = ?"
);
const updateYear = db.prepare(
  "UPDATE documents SET year = ? WHERE id = ?"
);
const insertVesselLink = db.prepare(
  "INSERT OR IGNORE INTO document_vessel_types (document_id, vessel_type_id) VALUES (?, ?)"
);
const insertCfrLink = db.prepare(
  "INSERT OR IGNORE INTO document_cfr_sections (document_id, cfr_section_id) VALUES (?, ?)"
);

let stats = {
  titlesUpdated: 0,
  yearsUpdated: 0,
  vesselLinksCreated: 0,
  cfrSectionsCreated: 0,
  cfrLinksCreated: 0,
};

const enrichAll = db.transaction(() => {
  for (const doc of docs) {
    const slug = doc.document_id.split("/").pop()!;

    // --- Get text (pdftotext preferred, DB fallback) ---
    let text = getPdfText(slug);
    if (text.trim().length < 100) text = doc.db_text;

    // --- Subject / Title ---
    const isManual = slug in MANUAL_SUBJECTS;
    let subject: string | null = isManual
      ? MANUAL_SUBJECTS[slug]
      : (extractSubject(text) ?? (doc.db_text ? extractSubject(doc.db_text) : null));

    if (subject && !isManual) {
      // Title-case the subject for cleaner display (skip manual entries)
      const ACRONYMS = new Set([
        "SOLAS","MARPOL","CFR","VDR","STCW","GMDSS","ISSC","ISM","IMO",
        "USCG","OSV","MODU","BWM","AAWPP","ACSA","DWTF","UPV","MMC",
        "TWIC","DC","TPO","TSMS","NCOE","OCMI","VHF","DSC","ACS",
        "USC","MSC","MISLE","II","III","IV","VI","U.S.","OCS",
        "NVIC","COMDTINST","PQS","EAMI","GRT","GT","FCC",
      ]);
      subject = subject
        .split(" ")
        .map((w, i) => {
          const stripped = w.replace(/[^A-Za-z.]/g, "").toUpperCase();
          if (ACRONYMS.has(stripped)) return stripped;
          const parenMatch = w.match(/^\(([A-Za-z]{2,})\)$/);
          if (parenMatch && ACRONYMS.has(parenMatch[1].toUpperCase()))
            return `(${parenMatch[1].toUpperCase()})`;
          if (/^\d+\/\d+/.test(w) || /^[IVX]+\//.test(w)) return w;
          const small = new Set([
            "a","an","and","as","at","but","by","for","in","of",
            "on","or","the","to","with","nor","yet","so",
          ]);
          if (i > 0 && small.has(w.toLowerCase())) return w.toLowerCase();
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(" ");
    }

    if (subject && subject !== doc.title) {
      updateTitle.run(subject, doc.id);
      stats.titlesUpdated++;
    }

    // --- Year ---
    const year = deriveYear(doc.document_id);
    if (year && year !== doc.year) {
      updateYear.run(year, doc.id);
      stats.yearsUpdated++;
    }

    // --- Vessel Types ---
    const vesselTypes = extractVesselTypes(text || doc.db_text);
    for (const vt of vesselTypes) {
      const dbName = VESSEL_TYPE_MAP[vt];
      if (!dbName) continue;
      const vtId = getVesselTypeId(dbName);
      if (vtId) {
        const result = insertVesselLink.run(doc.id, vtId);
        if (result.changes > 0) stats.vesselLinksCreated++;
      }
    }

    // --- CFR References ---
    const cfrRefs = extractCfrRefs(text || doc.db_text);
    for (const ref of cfrRefs) {
      const sectionId = getOrCreateCfrSection(ref);
      if (sectionId) {
        const existed = db
          .prepare(
            "SELECT 1 FROM document_cfr_sections WHERE document_id = ? AND cfr_section_id = ?"
          )
          .get(doc.id, sectionId);
        if (!existed) {
          insertCfrLink.run(doc.id, sectionId);
          stats.cfrLinksCreated++;
        }
      }
    }
  }

  // Update doc_count on vessel_types
  db.exec(`
    UPDATE vessel_types SET doc_count = (
      SELECT COUNT(*) FROM document_vessel_types WHERE vessel_type_id = vessel_types.id
    )
  `);
});

enrichAll();

// Count new cfr_sections
stats.cfrSectionsCreated = (
  db.prepare("SELECT COUNT(*) as cnt FROM cfr_sections").get() as {
    cnt: number;
  }
).cnt;

console.log("=== Enrichment complete ===");
console.log(`  Titles updated:      ${stats.titlesUpdated}`);
console.log(`  Years populated:     ${stats.yearsUpdated}`);
console.log(`  Vessel type links:   ${stats.vesselLinksCreated}`);
console.log(`  CFR sections created:${stats.cfrSectionsCreated}`);
console.log(`  CFR links created:   ${stats.cfrLinksCreated}`);

// Summary verification
const verify = db
  .prepare(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN year IS NOT NULL THEN 1 ELSE 0 END) as has_year,
      SUM(CASE WHEN title != document_id THEN 1 ELSE 0 END) as has_real_title
    FROM documents WHERE collection_id = 'policy-letter'`
  )
  .get() as { total: number; has_year: number; has_real_title: number };

const vtCount = (
  db
    .prepare(
      `SELECT COUNT(DISTINCT dvt.document_id) as cnt
       FROM document_vessel_types dvt
       JOIN documents d ON dvt.document_id = d.id
       WHERE d.collection_id = 'policy-letter'`
    )
    .get() as { cnt: number }
).cnt;

const cfrCount = (
  db
    .prepare(
      `SELECT COUNT(DISTINCT dcs.document_id) as cnt
       FROM document_cfr_sections dcs
       JOIN documents d ON dcs.document_id = d.id
       WHERE d.collection_id = 'policy-letter'`
    )
    .get() as { cnt: number }
).cnt;

console.log(`\n=== Coverage (${verify.total} policy letters) ===`);
console.log(`  Has year:        ${verify.has_year}/${verify.total}`);
console.log(`  Has real title:  ${verify.has_real_title}/${verify.total}`);
console.log(`  Has vessel types:${vtCount}/${verify.total}`);
console.log(`  Has CFR refs:    ${cfrCount}/${verify.total}`);

db.close();

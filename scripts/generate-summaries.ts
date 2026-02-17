/**
 * Generate summaries for all documents that don't have one.
 * Extracts text from PDFs via pdftotext, then builds a concise summary
 * from the first ~2000 chars of each document.
 *
 * Run: npx tsx scripts/generate-summaries.ts
 */
import Database from "better-sqlite3";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

interface DocRow {
  id: number;
  document_id: string;
  filepath: string;
  collection_id: string;
  title: string;
}

// ── CFR summaries from part titles (already known) ──────────────────────
const CFR_SUMMARIES: Record<string, string> = {
  "33-160": "Establishes requirements for ports and waterways safety, including vessel traffic control, notices of arrival, hazardous conditions reporting, and Captain of the Port authority.",
  "33-164": "Sets navigation safety regulations including requirements for vessel equipment, navigation bridge visibility, tests and inspections before entering or getting underway, and charts and publications.",
  "46-1": "Describes the organization, general course, and methods governing Coast Guard marine safety functions including vessel inspection procedures and jurisdictional authority.",
  "46-2": "Establishes procedures for vessel inspections including application, scheduling, conduct of inspections, and issuance of certificates of inspection.",
  "46-3": "Provides procedures for designation of oceanographic research vessels and requirements for their inspection and certification.",
  "46-4": "Establishes requirements for reporting, investigating, and documenting marine casualties including deaths, injuries, and property damage.",
  "46-5": "Governs marine investigation regulations related to personnel actions including suspension and revocation proceedings for merchant mariner credentials.",
  "46-6": "Addresses waivers of navigation and vessel inspection laws and regulations, including procedures for requesting and granting exemptions.",
  "46-7": "Defines boundary lines dividing inland waters from the high seas for purposes of applying different navigation rules and vessel inspection requirements.",
  "46-8": "Provides alternatives to traditional vessel inspection requirements, including the Alternate Compliance Program (ACP) for recognized classification societies.",
  "46-9": "Establishes procedures for extra compensation for overtime services performed by Coast Guard marine inspectors outside regular working hours.",
  "46-10": "Defines requirements for Merchant Mariner Credentials including application procedures, eligibility, physical and medical standards, and renewal requirements.",
  "46-11": "Establishes requirements for officer endorsements on merchant mariner credentials including sea service, examination, and training requirements for deck and engineer officers.",
  "46-12": "Sets requirements for rating endorsements including able seaman, qualified member of the engine department, and other unlicensed mariner positions.",
  "46-13": "Establishes requirements for certification of tankermen including training, experience, and examination requirements for personnel handling dangerous liquids.",
  "46-14": "Governs the shipment and discharge of merchant mariners including shipping articles, wages, and crew documentation requirements.",
  "46-15": "Establishes manning requirements for inspected vessels including minimum crew sizes, watchkeeping standards, and officer complement requirements.",
  "46-16": "Sets chemical testing requirements for merchant mariners including pre-employment, random, post-casualty, and reasonable cause drug and alcohol testing.",
  "46-24": "Provides general provisions applicable to uninspected vessels including definitions, applicability, and basic safety requirements.",
  "46-25": "Establishes safety requirements for uninspected vessels including lifesaving, firefighting equipment, ventilation, and backfire flame control.",
  "46-26": "Defines conditions under which vessels must obtain certificates of inspection based on route, tonnage, passengers carried, or cargo type.",
  "46-27": "Establishes safety requirements specific to towing vessels including navigation equipment, crew qualifications, and operational procedures.",
  "46-28": "Sets safety requirements for commercial fishing industry vessels including stability, lifesaving equipment, firefighting, and crew training.",
  "46-30": "Provides general provisions for tank vessels including definitions, applicability, and basic requirements for vessels carrying liquid cargo in bulk.",
  "46-31": "Establishes inspection and certification requirements for tank vessels including initial, periodic, and drydock inspections.",
  "46-32": "Sets special equipment, machinery, and hull requirements for tank vessels including cargo containment, piping systems, and structural standards.",
  "46-34": "Defines firefighting equipment requirements for tank vessels including fixed and portable fire extinguishing systems, fire detection, and fire main systems.",
  "46-35": "Establishes operational requirements for tank vessels including cargo handling procedures, tankerman duties, and safety precautions.",
  "46-36": "Governs the carriage of elevated temperature cargoes on tank vessels including heating systems, safety measures, and handling procedures.",
  "46-38": "Sets requirements for tank vessels carrying liquefied flammable gases including cargo containment, safety systems, and operational procedures.",
  "46-39": "Establishes requirements for vapor control systems on tank vessels including design, testing, and operational standards for vapor recovery and destruction.",
  "46-42": "Governs load line requirements for domestic and foreign voyages by sea including assignment of freeboards, markings, and surveys.",
  "46-44": "Provides special service limited domestic voyage load line requirements for vessels operating on sheltered waters or restricted routes.",
  "46-45": "Establishes Great Lakes load line requirements including seasonal zones, freeboards, and stability criteria specific to Great Lakes operations.",
  "46-46": "Sets subdivision load line requirements for passenger vessels including damage stability calculations and watertight subdivision standards.",
  "46-47": "Addresses combination load line requirements for vessels that need both international and Great Lakes load line certificates.",
  "46-50": "Provides general provisions for marine engineering including definitions, applicability, and references to standards for vessel machinery and systems.",
  "46-52": "Establishes requirements for power boilers on vessels including design, construction, installation, inspection, and testing standards.",
  "46-53": "Sets requirements for heating boilers on vessels including design pressures, safety valves, and inspection requirements.",
  "46-54": "Defines requirements for pressure vessels on vessels including design, materials, fabrication, inspection, and testing standards.",
  "46-56": "Establishes requirements for piping systems and appurtenances including materials, design, testing, and installation standards for vessel piping.",
  "46-57": "Sets welding and brazing requirements for vessel construction and repair including welder qualifications, procedures, and inspection standards.",
  "46-58": "Governs main and auxiliary machinery and related systems including propulsion, steering, ventilation, and refrigeration equipment requirements.",
  "46-59": "Establishes requirements for repairs to boilers, pressure vessels, and appurtenances including repair procedures, inspector qualifications, and testing.",
  "46-61": "Sets requirements for periodic tests and inspections of marine engineering equipment including boilers, pressure vessels, and safety devices.",
  "46-62": "Defines requirements for vital system automation on vessels including automated machinery spaces, alarm systems, and remote control standards.",
  "46-63": "Establishes requirements for automatic auxiliary boilers including design, installation, safety controls, and maintenance standards.",
  "46-64": "Governs marine portable tanks and cargo handling systems including design, testing, marking, and operational requirements.",
  "46-67": "Establishes procedures for documentation of vessels including registration, enrollment, licensing, and requirements for coastwise trade eligibility.",
  "46-68": "Provides exceptions to coastwise qualification requirements for vessel documentation including waivers and special provisions.",
  "46-69": "Sets requirements for measurement of vessels including tonnage calculation methods and measurement procedures.",
  "46-70": "Provides general provisions for passenger vessels including definitions, applicability, and basic requirements for vessels carrying passengers for hire.",
  "46-71": "Establishes inspection and certification requirements for passenger vessels including initial, periodic, drydock, and underwater inspections.",
  "46-72": "Sets construction and arrangement requirements for passenger vessels including structural fire protection, means of escape, and accommodation standards.",
  "46-76": "Defines fire protection equipment requirements for passenger vessels including detection, alarm, extinguishing systems, and fire safety measures.",
  "46-77": "Establishes requirements for vessel control and miscellaneous systems and equipment on passenger vessels including steering, anchoring, and navigation.",
  "46-78": "Sets operational requirements for passenger vessels including emergency procedures, passenger safety, and crew responsibilities.",
  "46-80": "Requires disclosure of safety standards and country of registry for passenger vessels operating from United States ports.",
  "46-90": "Provides general provisions for cargo and miscellaneous vessels including definitions, applicability, and basic requirements.",
  "46-91": "Establishes inspection and certification requirements for cargo and miscellaneous vessels including initial and periodic inspections.",
  "46-92": "Sets construction and arrangement requirements for cargo vessels including structural fire protection, means of escape, and cargo spaces.",
  "46-93": "Establishes stability requirements for cargo and miscellaneous vessels including intact and damage stability criteria and stability information.",
  "46-95": "Defines fire protection equipment requirements for cargo and miscellaneous vessels including fixed and portable systems.",
  "46-96": "Establishes requirements for vessel control and miscellaneous systems on cargo vessels including steering, anchoring, and communication equipment.",
  "46-97": "Sets operational requirements for cargo and miscellaneous vessels including emergency procedures and cargo handling.",
  "46-98": "Governs special construction, arrangement, and provisions for carrying certain dangerous cargoes in bulk on cargo vessels.",
  "46-105": "Establishes requirements for commercial fishing vessels dispensing petroleum products including equipment, operations, and safety standards.",
  "46-106": "Provides requirements for nonqualified vessels performing certain aquaculture support operations including inspection and safety standards.",
  "46-107": "Establishes inspection and certification requirements for Mobile Offshore Drilling Units (MODUs) including initial and periodic surveys.",
  "46-108": "Sets design and equipment requirements for MODUs including structural, stability, lifesaving, and fire protection standards.",
  "46-109": "Defines operational requirements for MODUs including manning, emergency procedures, and environmental compliance.",
  "46-110": "Provides general provisions for electrical engineering on vessels including definitions, applicability, and references to standards.",
  "46-111": "Establishes general requirements for electric systems on vessels including power generation, distribution, grounding, and hazardous area protection.",
  "46-112": "Sets requirements for emergency lighting and power systems on vessels including emergency generators, battery systems, and distribution.",
  "46-113": "Establishes requirements for communication and alarm systems and equipment on vessels including internal communications and general alarms.",
  "46-114": "Provides general provisions for small passenger vessels under 100 gross tons including definitions and applicability.",
  "46-115": "Establishes inspection and certification requirements for small passenger vessels under 100 gross tons.",
  "46-116": "Sets construction and arrangement requirements for small passenger vessels including structural fire protection and means of escape.",
  "46-117": "Defines lifesaving equipment and arrangement requirements for small passenger vessels including survival craft and personal flotation devices.",
  "46-118": "Establishes fire protection equipment requirements for small passenger vessels including detection, alarm, and extinguishing systems.",
  "46-119": "Sets machinery installation requirements for small passenger vessels including propulsion, fuel systems, and exhaust systems.",
  "46-120": "Defines electrical installation requirements for small passenger vessels including power sources, wiring, and lighting.",
  "46-121": "Establishes requirements for vessel control and miscellaneous systems on small passenger vessels including steering and navigation equipment.",
  "46-122": "Sets operational requirements for small passenger vessels including emergency procedures, manning, and passenger safety.",
  "46-125": "Provides general provisions for offshore supply vessels including definitions, applicability, and basic requirements.",
  "46-126": "Establishes inspection and certification requirements for offshore supply vessels including initial, periodic, and drydock inspections.",
  "46-127": "Sets construction and arrangement requirements for offshore supply vessels including structural fire protection and accommodation standards.",
  "46-128": "Defines marine engineering equipment and systems requirements for offshore supply vessels including machinery and piping.",
  "46-129": "Establishes electrical installation requirements for offshore supply vessels including power generation, distribution, and lighting.",
  "46-130": "Sets requirements for vessel control and miscellaneous equipment on offshore supply vessels including steering and navigation systems.",
  "46-131": "Defines operational requirements for offshore supply vessels including manning, stability, and cargo handling procedures.",
  "46-132": "Establishes fire protection equipment requirements for offshore supply vessels including fixed and portable fire extinguishing systems.",
  "46-133": "Sets lifesaving requirements for offshore supply vessels including survival craft, personal flotation devices, and rescue equipment.",
  "46-134": "Provides additional requirements specific to liftboats including structural, stability, and operational standards.",
  "46-136": "Establishes certification requirements for towing vessels under Subchapter M including COI issuance, routes, and manning.",
  "46-137": "Sets vessel compliance requirements for towing vessels including survey and examination procedures under the TSMS option.",
  "46-138": "Defines Towing Safety Management System (TSMS) requirements including policies, procedures, audits, and management reviews.",
  "46-139": "Establishes requirements for third-party organizations (TPOs) performing audits and surveys of towing vessels under Subchapter M.",
  "46-140": "Sets operational requirements for towing vessels including voyage planning, navigation safety, emergency procedures, and crew training.",
  "46-141": "Defines lifesaving requirements for towing vessels including survival craft, personal flotation devices, and distress signals.",
  "46-142": "Establishes fire protection requirements for towing vessels including fire detection, extinguishing systems, and structural fire protection.",
  "46-143": "Sets machinery and electrical systems requirements for towing vessels including propulsion, steering, fuel, and electrical standards.",
  "46-144": "Defines construction and arrangement requirements for towing vessels including structural standards, watertight integrity, and accommodation.",
  "46-147": "Governs requirements for hazardous ships' stores including stowage, handling, and labeling of dangerous materials carried for vessel use.",
  "46-148": "Sets requirements for carriage of bulk solid materials that require special handling including grain, concentrates, and hazardous solids.",
  "46-150": "Establishes compatibility requirements for cargoes carried on vessels including segregation and reactivity considerations.",
  "46-151": "Governs requirements for barges carrying bulk liquid hazardous material cargoes including construction, equipment, and operations.",
  "46-153": "Sets requirements for ships carrying bulk liquid, liquefied gas, or compressed gas hazardous materials including cargo systems and safety.",
  "46-154": "Establishes safety standards for self-propelled vessels carrying bulk liquefied gases including containment, instrumentation, and firefighting.",
  "46-159": "Provides procedures for approval of equipment and materials used on vessels including testing, certification, and marking requirements.",
  "46-160": "Establishes standards for lifesaving equipment including lifeboats, life rafts, personal flotation devices, and associated launching equipment.",
  "46-161": "Sets standards for electrical equipment used on vessels including motors, generators, switchboards, and cable specifications.",
  "46-162": "Defines standards for engineering equipment used on vessels including valves, fittings, and mechanical components.",
  "46-163": "Establishes construction standards for vessel structural components including materials, welding, and fabrication requirements.",
  "46-164": "Sets standards for materials used in vessel construction including metals, non-metallic materials, and approved specifications.",
  "46-166": "Provides requirements for designation and approval of nautical school ships including inspection standards and safety requirements.",
  "46-167": "Establishes requirements for public nautical school ships including construction, equipment, and operational standards.",
  "46-168": "Sets requirements for civilian nautical school vessels including inspection, equipment, and safety standards.",
  "46-169": "Defines requirements for sailing school vessels including construction, stability, lifesaving, and operational standards.",
  "46-170": "Establishes stability requirements applicable to all inspected vessels including intact stability criteria, stability tests, and stability information.",
  "46-171": "Sets special stability rules for vessels carrying passengers including damage stability, subdivision, and watertight integrity requirements.",
  "46-172": "Defines special stability rules pertaining to bulk cargoes including grain loading, ore carriers, and timber deck cargoes.",
  "46-173": "Establishes special stability rules based on vessel use including towing, dredging, and lifting operations.",
  "46-174": "Sets special stability rules for specific vessel types including barges, mobile offshore drilling units, and sailing vessels.",
  "46-175": "Provides general provisions for small passenger vessels under 100 GT (Subchapter T) including definitions and applicability.",
  "46-176": "Establishes inspection and certification requirements for small passenger vessels under Subchapter T.",
  "46-177": "Sets construction and arrangement requirements for small passenger vessels under Subchapter T including materials and structural standards.",
  "46-178": "Defines intact stability and seaworthiness requirements for small passenger vessels including stability tests and criteria.",
  "46-179": "Establishes subdivision, damage stability, and watertight integrity requirements for small passenger vessels under Subchapter T.",
  "46-180": "Sets lifesaving equipment and arrangement requirements for small passenger vessels under Subchapter T.",
  "46-181": "Defines fire protection equipment requirements for small passenger vessels under Subchapter T.",
  "46-182": "Establishes machinery installation requirements for small passenger vessels under Subchapter T including engines, fuel, and exhaust.",
  "46-183": "Sets electrical installation requirements for small passenger vessels under Subchapter T including wiring, lighting, and power sources.",
  "46-184": "Defines requirements for vessel control and miscellaneous systems on small passenger vessels under Subchapter T.",
  "46-185": "Establishes operational requirements for small passenger vessels under Subchapter T including manning, drills, and passenger safety.",
  "46-188": "Provides general provisions for oceanographic research vessels including definitions, applicability, and basic requirements.",
  "46-189": "Establishes inspection and certification requirements for oceanographic research vessels.",
  "46-190": "Sets construction and arrangement requirements for oceanographic research vessels including structural and accommodation standards.",
  "46-193": "Defines fire protection equipment requirements for oceanographic research vessels.",
  "46-194": "Governs handling, use, and control of explosives and other hazardous materials on oceanographic research vessels.",
  "46-195": "Establishes requirements for vessel control and miscellaneous systems on oceanographic research vessels.",
  "46-196": "Sets operational requirements for oceanographic research vessels including manning and emergency procedures.",
  "46-197": "Provides general provisions for marine occupational safety and health standards applicable to inspected vessels.",
  "46-199": "Establishes lifesaving systems requirements for certain inspected vessels including survival craft and rescue boat standards.",
};

// ── Extract text from PDF ───────────────────────────────────────────────
function extractPdfText(filepath: string, maxChars = 3000): string {
  const fullPath = path.join(ROOT, filepath);
  if (!fs.existsSync(fullPath)) return "";
  try {
    const text = execSync(`pdftotext "${fullPath}" - 2>/dev/null`, {
      maxBuffer: 1024 * 1024,
      timeout: 30000,
    }).toString();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}

// ── Fallback: get text from document_text table ─────────────────────────
function getDbText(docId: number, maxChars = 3000): string {
  const row = db.prepare(
    "SELECT content FROM document_text WHERE document_id = ? LIMIT 1"
  ).get(docId) as { content: string } | undefined;
  return row?.content?.slice(0, maxChars) || "";
}

// ── Extract subject from text using multiple patterns ────────────────────
function extractSubject(text: string): string | null {
  if (!text || text.length < 30) return null;

  // Pattern 1: Subj/Subject line (most CG docs)
  const subjPatterns = [
    /(?:Subj|Subject|SUBJECT|SUBJ)[:\s]+(.+?)(?:\n\s*\n|Ref:|REF:|1\.\s+PURPOSE|Encl)/si,
    /(?:Subj|Subject|SUBJECT|SUBJ)[:\s]+(.+?)(?:\n[A-Z])/s,
  ];
  for (const pat of subjPatterns) {
    const m = text.match(pat);
    if (m) {
      let subj = m[1].trim().replace(/\s+/g, " ");
      if (subj.length > 250) subj = subj.slice(0, 250).replace(/\s\S*$/, "");
      if (subj.length > 15) return subj;
    }
  }

  // Pattern 2: Purpose section
  const purposePatterns = [
    /(?:1\.\s+)?Purpose[:\s.]+(.+?)(?:\n\s*\n|2\.\s+|References|Ref)/si,
    /Purpose[:\s]+(.+?)(?:\n\s*\n)/si,
  ];
  for (const pat of purposePatterns) {
    const m = text.match(pat);
    if (m) {
      let purpose = m[1].trim().replace(/\s+/g, " ");
      if (purpose.length > 250) purpose = purpose.slice(0, 250).replace(/\s\S*$/, "");
      if (purpose.length > 20) return purpose;
    }
  }

  // Pattern 3: Title at top of document (PRGs often have this)
  const titlePattern = text.match(/^(.+?)(?:\n\s*\n|Procedure Number)/s);
  if (titlePattern) {
    let title = titlePattern[1].trim().replace(/\s+/g, " ");
    // Skip if it's just a header like "MSC Guidelines..."
    if (title.length > 10 && title.length < 200) return title;
  }

  return null;
}

// ── Generate summary from document_id slug (fallback) ───────────────────
function summaryFromSlug(documentId: string): string | null {
  const slug = documentId.split("/").pop() || "";

  // PRG/DVG: strip prefix, date, convert hyphens to spaces, title-case
  // e.g. PRG.e1-02.2020.07.10.bilge-and-ballast-systems -> "Bilge and Ballast Systems"
  const prgMatch = slug.match(/^(?:PRG|DVG)\.[a-zA-Z\d]+-\d+\.(?:\d{4}\.\d{2}\.\d{2}\.)?(.+)$/i);
  if (prgMatch) {
    let desc = prgMatch[1]
      .replace(/-/g, " ")
      .replace(/\.\s*$/, "")
      .trim();
    if (desc.length > 5) return desc;
  }

  // NVIC: strip prefix, convert hyphens
  const nvicMatch = slug.match(/^NVIC-\d{2}-\d{2}(?:-ch\d+)?-(.+)$/i);
  if (nvicMatch) {
    let desc = nvicMatch[1].replace(/-/g, " ").trim();
    if (desc.length > 5) return desc;
  }

  // IO Guidance: handle MCI and other formats
  const mciMatch = slug.match(/^MCI-\d+[a-z]?-(.+?)(?:-v\d+(?:-\d+)?)?$/i);
  if (mciMatch) {
    let desc = mciMatch[1].replace(/-/g, " ").trim();
    if (desc.length > 5) return desc;
  }

  const ioMatch = slug.match(/^(?:IO|CG-INV)-.*?-(.+?)(?:-v\d+)?$/i);
  if (ioMatch) {
    let desc = ioMatch[1].replace(/-/g, " ").trim();
    if (desc.length > 5) return desc;
  }

  // Generic: just convert the slug
  if (slug.length > 10) {
    let desc = slug.replace(/[-._]/g, " ").trim();
    if (desc.length > 5) return desc;
  }

  return null;
}

// ── Generate summary from extracted text ────────────────────────────────
function generateSummary(text: string, collection: string, title: string, documentId: string): string | null {
  // Try text extraction first
  const fromText = extractSubject(text);
  if (fromText) return fromText;

  // Fallback: derive from document_id slug
  return summaryFromSlug(documentId);
}

// ── Title case helper ───────────────────────────────────────────────────
function titleCaseSummary(str: string): string {
  // Only title-case if mostly uppercase
  const upperCount = (str.match(/[A-Z]/g) || []).length;
  const letterCount = (str.match(/[A-Za-z]/g) || []).length;
  if (letterCount === 0 || upperCount / letterCount < 0.6) return str;

  const minor = new Set(["a","an","and","at","but","by","for","in","of","on","or","the","to","vs"]);
  const acronyms = new Set(["CFR","USCG","SOLAS","MARPOL","STCW","IMO","ABS","IACS","NVIC","MTN","PRG","DVG","OCS","MODU","TSMS","TPO","COI","ACP","NRT","EPA","DOT","ISM","ISPS","MTSA","BWM","VGP","ECA","ECDIS","AIS","GMDSS","EPIRB","LRIT","NOA","PSC","FSI","MSC","ISM","TWIC","MMC","OS","AB","QMED","MCP","CG","CVC","OPA","NRC"]);

  return str
    .split(/\s+/)
    .map((w, i) => {
      const upper = w.toUpperCase();
      if (acronyms.has(upper)) return upper;
      const lower = w.toLowerCase();
      if (i > 0 && minor.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

// ── Main ────────────────────────────────────────────────────────────────
const docs = db.prepare(
  "SELECT id, document_id, filepath, collection_id, title FROM documents WHERE summary IS NULL ORDER BY collection_id, document_id"
).all() as DocRow[];

console.log(`Found ${docs.length} documents without summaries\n`);

const updateStmt = db.prepare("UPDATE documents SET summary = ? WHERE id = ?");
let updated = 0;
let skipped = 0;

const collectionCounts: Record<string, { total: number; done: number }> = {};

for (const doc of docs) {
  if (!collectionCounts[doc.collection_id]) {
    collectionCounts[doc.collection_id] = { total: 0, done: 0 };
  }
  collectionCounts[doc.collection_id].total++;

  let summary: string | null = null;

  // CFR: use pre-written summaries
  if (doc.collection_id === "cfr") {
    // Extract key from document_id: cfr/46-CFR-Part-10 -> 46-10
    const m = doc.document_id.match(/cfr\/(\d+)-CFR-[Pp]art-?(\d+)/);
    if (m) {
      const key = `${m[1]}-${m[2]}`;
      summary = CFR_SUMMARIES[key] || null;
    }
  }

  // Other collections: extract from PDF
  if (!summary) {
    const text = extractPdfText(doc.filepath) || getDbText(doc.id);
    summary = generateSummary(text, doc.collection_id, doc.title, doc.document_id);
    if (summary) {
      summary = titleCaseSummary(summary);
    }
  }

  if (summary) {
    updateStmt.run(summary, doc.id);
    collectionCounts[doc.collection_id].done++;
    updated++;
  } else {
    skipped++;
    console.log(`  SKIP: ${doc.document_id} (no summary extracted)`);
  }
}

console.log(`\n── Results ──`);
for (const [col, counts] of Object.entries(collectionCounts).sort()) {
  console.log(`  ${col}: ${counts.done}/${counts.total} summaries added`);
}
console.log(`\nTotal: ${updated} updated, ${skipped} skipped`);

db.close();

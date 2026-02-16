/**
 * Seed / update CFR metadata: rename subcategories, merge topics, create
 * vessel types, and assign topics + vessel types to CFR part documents.
 * Run: npx tsx scripts/seed-cfr-metadata.ts
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Find the internal `documents.id` for a CFR part number.
 *  Handles both formats:
 *    46 CFR  → cfr/46-CFR-Part-{N}   (exact end with "-Part-{N}")
 *    33 CFR  → cfr/33-CFR-part{N}    (exact end with "part{N}")
 *  The trailing-char check avoids matching Part-10 when looking for Part-1.
 */
function docIdsForPart(partNum: number): number[] {
  const rows = db
    .prepare(
      `SELECT id FROM documents
       WHERE collection_id = 'cfr'
         AND (   document_id = 'cfr/46-CFR-Part-' || ?
              OR document_id = 'cfr/33-CFR-part'  || ? )`
    )
    .all(String(partNum), String(partNum)) as { id: number }[];
  return rows.map((r) => r.id);
}

function getTopicId(name: string): number | null {
  const row = db
    .prepare("SELECT id FROM topics WHERE name = ?")
    .get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

function getVesselTypeId(name: string): number | null {
  const row = db
    .prepare("SELECT id FROM vessel_types WHERE name = ?")
    .get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

const insertDocTopic = db.prepare(
  "INSERT OR IGNORE INTO document_topics (document_id, topic_id) VALUES (?, ?)"
);

const insertDocVessel = db.prepare(
  "INSERT OR IGNORE INTO document_vessel_types (document_id, vessel_type_id) VALUES (?, ?)"
);

/* ------------------------------------------------------------------ */
/*  1. Rename subcategory on documents                                */
/* ------------------------------------------------------------------ */
console.log("\n=== Step 1: Rename subcategory ===");

const subRename = db.prepare(
  `UPDATE documents
     SET subcategory = '46 CFR'
   WHERE collection_id = 'cfr' AND subcategory = '46 CFR/Individual Parts'`
);
const subResult = subRename.run();
console.log(`  Updated ${subResult.changes} documents subcategory → '46 CFR'`);

/* ------------------------------------------------------------------ */
/*  2. Rename topic "46 CFR/Individual Parts" → "46 CFR"              */
/* ------------------------------------------------------------------ */
console.log("\n=== Step 2: Rename topic ===");

const topicRename = db.prepare(
  `UPDATE topics SET name = '46 CFR', slug = '46-cfr'
   WHERE name = '46 CFR/Individual Parts'`
);
const topicResult = topicRename.run();
console.log(`  Renamed topic (${topicResult.changes} row)`);

/* ------------------------------------------------------------------ */
/*  3. Merge lifesaving topics                                        */
/* ------------------------------------------------------------------ */
console.log("\n=== Step 3: Merge lifesaving topics ===");

const mergeTx = db.transaction(() => {
  const pfdId = getTopicId("Personal Floatation Devices PFDs");
  const lifeId = getTopicId("Life Boats Life Rafts");

  // Create or find "Lifesaving"
  db.prepare(
    "INSERT OR IGNORE INTO topics (name, slug, doc_count) VALUES ('Lifesaving', 'lifesaving', 0)"
  ).run();
  const lifesavingId = getTopicId("Lifesaving")!;
  console.log(`  Lifesaving topic id = ${lifesavingId}`);

  let moved = 0;
  for (const oldId of [pfdId, lifeId]) {
    if (oldId == null) continue;
    // Move document_topics entries to new topic
    const entries = db
      .prepare("SELECT document_id FROM document_topics WHERE topic_id = ?")
      .all(oldId) as { document_id: number }[];
    for (const e of entries) {
      insertDocTopic.run(e.document_id, lifesavingId);
      moved++;
    }
    // Delete old junction rows
    db.prepare("DELETE FROM document_topics WHERE topic_id = ?").run(oldId);
    // Delete old topic
    db.prepare("DELETE FROM topics WHERE id = ?").run(oldId);
    console.log(`  Merged old topic id=${oldId} (${entries.length} doc links)`);
  }
  console.log(`  Total doc links moved/created: ${moved}`);
});
mergeTx();

/* ------------------------------------------------------------------ */
/*  4. Create vessel types                                            */
/* ------------------------------------------------------------------ */
console.log("\n=== Step 4: Create vessel types ===");

const vesselTypes = [
  { name: "Tank Vessels", slug: "tank-vessels" },
  { name: "Passenger Vessels", slug: "passenger-vessels" },
  { name: "Cargo and Miscellaneous Vessels", slug: "cargo-miscellaneous-vessels" },
  { name: "Mobile Offshore Drilling Units", slug: "mobile-offshore-drilling-units" },
  { name: "Small Passenger Vessels", slug: "small-passenger-vessels" },
  { name: "Offshore Supply Vessels", slug: "offshore-supply-vessels" },
  { name: "Towing Vessels", slug: "towing-vessels" },
  { name: "Oceanographic Vessels", slug: "oceanographic-vessels" },
  { name: "Uninspected Vessels", slug: "uninspected-vessels" },
  { name: "Commercial Fishing Vessels", slug: "commercial-fishing-vessels" },
];

const insertVessel = db.prepare(
  "INSERT OR IGNORE INTO vessel_types (name, slug, doc_count) VALUES (?, ?, 0)"
);
for (const v of vesselTypes) {
  insertVessel.run(v.name, v.slug);
}
console.log(`  Ensured ${vesselTypes.length} vessel types exist`);

/* ------------------------------------------------------------------ */
/*  5. Assign topics to CFR parts                                     */
/* ------------------------------------------------------------------ */
console.log("\n=== Step 5: Assign topics to CFR parts ===");

// Topic → part numbers (46 CFR unless noted)
const topicPartMap: Record<string, number[]> = {
  "Fire Safety": [34, 38, 76, 95, 118, 132, 142, 181, 193],
  Lifesaving: [117, 133, 141, 160, 180, 199],
  Stability: [42, 44, 45, 46, 47, 170, 171, 172, 173, 174, 178, 179],
  "Load Lines": [42, 44, 45, 46, 47],
  Cargo: [30, 31, 32, 34, 35, 36, 38, 39, 64, 98, 147, 148, 150, 151, 153, 154],
  "Inspection Programs": [1, 2, 3, 4, 5, 6, 7, 8, 9, 31, 67, 68, 69, 71, 91, 107, 115, 126, 136, 137, 176, 189],
  MMC: [10, 11, 12, 13, 14, 15, 16],
  "Passenger Vessel Safety": [
    70, 71, 72, 76, 77, 78, 80, 114, 115, 116, 117, 118, 119, 120, 121, 122,
    175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185,
  ],
  "OCS MODUs": [107, 108, 109],
  "Commercial Fishing Vessel Safety": [28, 105],
  "Plan Review": [
    50, 52, 53, 54, 56, 57, 58, 59, 61, 62, 63, 64, 72, 92, 110, 111, 112,
    113, 116, 127, 144, 159, 161, 162, 163, 164, 177, 190,
  ],
  Security: [80],
  SOLAS: [199],
  Barges: [151],
};

// Navigation is special — 33 CFR parts 160, 164
const navigationParts33: number[] = [160, 164];

const assignTopicTx = db.transaction(() => {
  let totalAssigned = 0;

  for (const [topicName, parts] of Object.entries(topicPartMap)) {
    const topicId = getTopicId(topicName);
    if (topicId == null) {
      console.log(`  WARNING: Topic '${topicName}' not found, skipping`);
      continue;
    }
    let count = 0;
    for (const p of parts) {
      const docIds = docIdsForPart(p);
      for (const did of docIds) {
        insertDocTopic.run(did, topicId);
        count++;
      }
    }
    console.log(`  ${topicName}: ${count} assignments`);
    totalAssigned += count;
  }

  // Navigation — 33 CFR parts
  const navTopicId = getTopicId("Navigation");
  if (navTopicId != null) {
    let navCount = 0;
    for (const p of navigationParts33) {
      // 33 CFR docs use format cfr/33-CFR-part{N}
      const rows = db
        .prepare(
          `SELECT id FROM documents
           WHERE document_id = 'cfr/33-CFR-part' || ?`
        )
        .all(String(p)) as { id: number }[];
      for (const r of rows) {
        insertDocTopic.run(r.id, navTopicId);
        navCount++;
      }
    }
    console.log(`  Navigation (33 CFR): ${navCount} assignments`);
    totalAssigned += navCount;
  }

  console.log(`  Total topic assignments attempted: ${totalAssigned}`);
});
assignTopicTx();

/* ------------------------------------------------------------------ */
/*  6. Assign vessel types to CFR parts                               */
/* ------------------------------------------------------------------ */
console.log("\n=== Step 6: Assign vessel types to CFR parts ===");

const vesselPartMap: Record<string, number[]> = {
  "Tank Vessels": [30, 31, 32, 34, 35, 36, 38, 39],
  "Passenger Vessels": [70, 71, 72, 76, 77, 78, 80],
  "Cargo and Miscellaneous Vessels": [90, 91, 92, 93, 95, 96, 97, 98, 105],
  "Mobile Offshore Drilling Units": [107, 108, 109],
  "Small Passenger Vessels": [
    114, 115, 116, 117, 118, 119, 120, 121, 122, 175, 176, 177, 178, 179,
    180, 181, 182, 183, 184, 185,
  ],
  "Offshore Supply Vessels": [125, 126, 127, 128, 129, 130, 131, 132, 133, 134],
  "Towing Vessels": [136, 137, 138, 139, 140, 141, 142, 143, 144],
  "Oceanographic Vessels": [188, 189, 190, 193, 194, 195, 196, 197],
  "Uninspected Vessels": [24, 25, 26, 27, 28],
  "Commercial Fishing Vessels": [28, 105],
};

const assignVesselTx = db.transaction(() => {
  let totalAssigned = 0;

  for (const [vesselName, parts] of Object.entries(vesselPartMap)) {
    const vtId = getVesselTypeId(vesselName);
    if (vtId == null) {
      console.log(`  WARNING: Vessel type '${vesselName}' not found, skipping`);
      continue;
    }
    let count = 0;
    for (const p of parts) {
      const docIds = docIdsForPart(p);
      for (const did of docIds) {
        insertDocVessel.run(did, vtId);
        count++;
      }
    }
    console.log(`  ${vesselName}: ${count} assignments`);
    totalAssigned += count;
  }

  console.log(`  Total vessel type assignments attempted: ${totalAssigned}`);
});
assignVesselTx();

/* ------------------------------------------------------------------ */
/*  7. Update doc_counts on topics and vessel_types                   */
/* ------------------------------------------------------------------ */
console.log("\n=== Step 7: Update doc_counts ===");

db.prepare(
  `UPDATE topics SET doc_count = (
     SELECT COUNT(*) FROM document_topics WHERE topic_id = topics.id
   )`
).run();
console.log("  Updated topics.doc_count");

db.prepare(
  `UPDATE vessel_types SET doc_count = (
     SELECT COUNT(*) FROM document_vessel_types WHERE vessel_type_id = vessel_types.id
   )`
).run();
console.log("  Updated vessel_types.doc_count");

/* ------------------------------------------------------------------ */
/*  Summary                                                           */
/* ------------------------------------------------------------------ */
console.log("\n=== Summary ===");

const topicsSummary = db
  .prepare("SELECT name, doc_count FROM topics ORDER BY name")
  .all() as { name: string; doc_count: number }[];
console.log("\nTopics:");
for (const t of topicsSummary) {
  console.log(`  ${t.name}: ${t.doc_count} docs`);
}

const vesselSummary = db
  .prepare("SELECT name, doc_count FROM vessel_types ORDER BY name")
  .all() as { name: string; doc_count: number }[];
console.log("\nVessel Types:");
for (const v of vesselSummary) {
  console.log(`  ${v.name}: ${v.doc_count} docs`);
}

const totalDocTopics = (
  db.prepare("SELECT COUNT(*) as c FROM document_topics").get() as { c: number }
).c;
const totalDocVessels = (
  db.prepare("SELECT COUNT(*) as c FROM document_vessel_types").get() as { c: number }
).c;
console.log(`\nTotal document_topics rows: ${totalDocTopics}`);
console.log(`Total document_vessel_types rows: ${totalDocVessels}`);

db.close();
console.log("\nDone.");

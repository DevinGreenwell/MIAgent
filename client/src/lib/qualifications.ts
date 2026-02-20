/** Static qualification definitions for the Study tab. */

export interface QualificationDef {
  id: string;
  label: string;
  fullName: string;
  group: "domestic" | "foreign";
  subchapter?: string;
  vesselType?: string;
  cfrParts?: number[];
  collections: string[];
  studyContext: string;
}

export const QUALIFICATIONS: QualificationDef[] = [
  // ── Domestic (alphabetical by id) ─────────────────────
  {
    id: "BI",
    label: "Barge Inspector",
    fullName: "Barge Inspector",
    group: "domestic",
    vesselType: "uninspected-vessels",
    cfrParts: [30, 31, 32, 33, 34, 35, 151, 153],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext:
      "Barge Inspector — Inspection of tank barges, deck barges, and other non-self-propelled vessels. Key areas: hull integrity, cargo containment, tank coating and condition, venting systems, pollution prevention equipment, towing gear, navigation lights and day shapes.",
  },
  {
    id: "DI",
    label: "Dry Dock Inspector",
    fullName: "Dry Dock Inspector",
    group: "domestic",
    cfrParts: [61, 71, 91, 107, 115, 176],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext:
      "Dry Dock Inspector — Conducts drydock and internal structural examinations across all vessel types. Key areas: hull plating condition, shell and bottom readings, sea valves and through-hull fittings, rudder and propeller inspection, cathodic protection, underwater hull coatings, ABS/class society coordination.",
  },
  {
    id: "HI",
    label: "Hull Inspector",
    fullName: "Hull Inspector",
    group: "domestic",
    cfrParts: [42, 44, 45, 46, 56, 58, 61, 71, 91, 115, 176],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter", "class-rules"],
    studyContext:
      "Hull Inspector — Hull structural inspections across all vessel types. Key areas: structural members and framing, watertight integrity, subdivision and stability, hull openings and closures, load line compliance, structural fire protection, freeboard and tonnage verification.",
  },
  {
    id: "HT",
    label: "Hull Tank Inspector",
    fullName: "Hull Tank Inspector",
    group: "domestic",
    vesselType: "tank-vessels",
    cfrParts: [30, 31, 32, 33, 34, 35, 39, 40, 151, 153],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext:
      "Hull Tank Inspector — Combined hull and cargo tank inspections for tank vessels and tank barges. Key areas: cargo tank structural integrity, tank coatings and linings, venting and gas-freeing systems, cargo piping, pollution prevention (OPA 90), double hull requirements, inert gas systems.",
  },
  {
    id: "KI",
    label: "K Inspector",
    fullName: "Small Passenger Vessels ≥100 GT (Subchapter K)",
    group: "domestic",
    subchapter: "K",
    vesselType: "small-passenger-vessels",
    cfrParts: [114, 115, 116, 117, 118, 119, 120, 121, 122],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext:
      "Subchapter K — Small Passenger Vessels of 100 GT and above. Similar to Subchapter T but with additional requirements for larger vessels. Key areas: structural fire protection, means of escape, stability, lifesaving equipment.",
  },
  {
    id: "MI",
    label: "Machinery Inspector",
    fullName: "Machinery Inspector",
    group: "domestic",
    cfrParts: [50, 52, 54, 56, 58, 62, 63],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext:
      "Machinery Inspector — Inspection of main propulsion, auxiliary machinery, and related systems across all vessel types. Key areas: diesel and gas turbine engines, reduction gears, shafting and bearings, fuel oil systems, bilge and ballast systems, steering gear, electrical systems and generators, automation and control systems.",
  },
  {
    id: "MODU",
    label: "MODU Inspector",
    fullName: "Mobile Offshore Drilling Unit Inspector",
    group: "domestic",
    subchapter: "IA",
    vesselType: "mobile-offshore-drilling-units",
    cfrParts: [107, 108, 109],
    collections: ["cfr", "nvic", "prg", "mtn", "class-rules"],
    studyContext:
      "Subchapter IA — Mobile Offshore Drilling Units (MODUs). Key areas: structural integrity, stability, marine evacuation systems, firefighting, industrial systems, classification society oversight. Includes both domestic and foreign-flag units operating on the OCS.",
  },
  {
    id: "MS",
    label: "Machinery Steam Inspector",
    fullName: "Machinery Steam Inspector",
    group: "domestic",
    cfrParts: [50, 52, 54, 56, 58, 62, 63],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext:
      "Machinery Steam Inspector — Specialized inspection of steam propulsion plants and high-pressure boiler systems. Key areas: boiler construction and testing (46 CFR 52–54), steam piping systems, pressure vessels, safety valves, boiler water treatment, superheaters and economizers, steam turbines, condensers.",
  },
  {
    id: "OSV",
    label: "OSV Inspector",
    fullName: "Offshore Supply Vessel Inspector",
    group: "domestic",
    subchapter: "L",
    vesselType: "offshore-supply-vessels",
    cfrParts: [125, 126, 127, 128, 129, 130, 131, 132, 133, 134],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext:
      "Subchapter L — Offshore Supply Vessels (OSVs). Key areas: deck cargo and stability with cargo, fire protection, lifesaving for offshore ops, machinery and piping, dynamic positioning systems. Often operate in Gulf of Mexico supporting oil and gas operations.",
  },
  {
    id: "TI",
    label: "T Inspector",
    fullName: "Small Passenger Vessels (Subchapter T)",
    group: "domestic",
    subchapter: "T",
    vesselType: "small-passenger-vessels",
    cfrParts: [175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185],
    collections: ["cfr", "nvic", "prg", "mtn", "policy-letter"],
    studyContext:
      "Subchapter T — Small Passenger Vessels under 100 GT carrying more than 6 passengers. Key areas: hull structure, stability, fire protection, lifesaving, machinery, electrical systems. Common inspection triggers: COI renewal, major conversion, drydock.",
  },
  // ── Foreign (alphabetical by id) ──────────────────────
  {
    id: "FCVE",
    label: "Foreign Chemical Vessel Examiner",
    fullName: "Foreign Chemical Vessel Examiner",
    group: "foreign",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext:
      "Foreign Chemical Vessel Examiner — Examination of foreign-flag chemical tankers for compliance with SOLAS, MARPOL Annex II, and the IBC Code. Key areas: cargo containment systems, tank coatings, venting and gas detection, cargo heating/cooling, pollution prevention, crew certification for chemical cargo operations.",
  },
  {
    id: "FFVE",
    label: "Foreign Freight Vessel Examiner",
    fullName: "Foreign Freight Vessel Examiner",
    group: "foreign",
    vesselType: "cargo-miscellaneous-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext:
      "Foreign Freight Vessel Examiner — Examination of foreign-flag freight/cargo vessels for compliance with SOLAS, MARPOL, and Load Line conventions. Key areas: structural safety, fire protection, lifesaving, cargo securing, ISM/ISPS compliance, crew certification (STCW), navigation equipment.",
  },
  {
    id: "FFTE",
    label: "Foreign Tank Vessel Examiner",
    fullName: "Foreign Tank Vessel Examiner",
    group: "foreign",
    vesselType: "tank-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext:
      "Foreign Tank Vessel Examiner — Examination of foreign-flag oil tankers for compliance with SOLAS, MARPOL Annex I, and related conventions. Key areas: cargo tank integrity, inert gas systems, crude oil washing, oil discharge monitoring, double hull requirements, pollution prevention, ISM/ISPS compliance.",
  },
  {
    id: "FGVE",
    label: "Foreign Gas Vessel Examiner",
    fullName: "Foreign Gas Vessel Examiner",
    group: "foreign",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext:
      "Foreign Gas Vessel Examiner — Examination of foreign-flag gas carriers (LNG/LPG) for compliance with SOLAS, MARPOL, and the IGC Code. Key areas: cargo containment systems, pressure relief, gas detection, emergency shutdown, cargo handling, re-liquefaction systems, crew certification for gas cargo operations.",
  },
  {
    id: "FPVE",
    label: "Foreign Passenger Vessel Examiner",
    fullName: "Foreign Passenger Vessel Examiner",
    group: "foreign",
    vesselType: "passenger-vessels",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext:
      "Foreign Passenger Vessel Examiner — Examination of foreign-flag passenger vessels and cruise ships for compliance with SOLAS, MARPOL, and MLC conventions. Key areas: structural fire protection, means of escape, lifesaving appliances (including MES), stability, crew drills, ISM/ISPS compliance, Safe Return to Port requirements.",
  },
  {
    id: "PSCE",
    label: "Port State Control Examiner",
    fullName: "Port State Control Examiner",
    group: "foreign",
    collections: ["cfr", "nvic", "imo", "prg", "mtn", "policy-letter"],
    studyContext:
      "Port State Control Examiner — General examination of foreign-flag vessels for compliance with international conventions (SOLAS, MARPOL, STCW, MLC). Key areas: ISM/ISPS compliance, structural safety, fire protection, lifesaving, pollution prevention, crew certification, detention criteria.",
  },
];

export const QUAL_BY_ID = new Map(QUALIFICATIONS.map((q) => [q.id, q]));

export const DOMESTIC_QUALS = QUALIFICATIONS.filter((q) => q.group === "domestic");
export const FOREIGN_QUALS = QUALIFICATIONS.filter((q) => q.group === "foreign");

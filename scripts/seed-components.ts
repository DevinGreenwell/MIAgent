/**
 * Seed systems, components, and deficiencies.
 * Run: npm run seed:components
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("Seeding systems and components...");

const insertSystem = db.prepare(
  "INSERT OR IGNORE INTO systems (name, color, sort_order) VALUES (?, ?, ?)"
);

const systems = [
  { name: "Propulsion", color: "#4a90d9", order: 1 },
  { name: "Fuel Oil", color: "#e6a23c", order: 2 },
  { name: "Bilge", color: "#67c23a", order: 3 },
  { name: "Electrical", color: "#f56c6c", order: 4 },
  { name: "Exhaust", color: "#909399", order: 5 },
  { name: "Cooling Water", color: "#409eff", order: 6 },
  { name: "Starting Air", color: "#e6a23c", order: 7 },
  { name: "Fire Safety", color: "#f56c6c", order: 8 },
];

for (const s of systems) {
  insertSystem.run(s.name, s.color, s.order);
}

const getSystemId = db.prepare("SELECT id FROM systems WHERE name = ?");
const insertComp = db.prepare(
  "INSERT OR IGNORE INTO components (mesh_name, display_name, description, inspection_notes, system_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
);

const components = [
  { mesh: "main-engine", name: "Main Engine", system: "Propulsion", desc: "Primary propulsion diesel engine", notes: "Check foundation bolts and chocks\nInspect crankcase for oil mist\nVerify governor operation\nCheck turbocharger bearings\nInspect fuel injection system", order: 1 },
  { mesh: "reduction-gear", name: "Reduction Gear", system: "Propulsion", desc: "Speed reduction gearbox between engine and shaft", notes: "Check oil level and condition\nInspect gear teeth for wear\nVerify alignment\nCheck bearing temperatures", order: 2 },
  { mesh: "propeller-shaft", name: "Propeller Shaft", system: "Propulsion", desc: "Main propulsion shaft connecting gearbox to propeller", notes: "Check shaft alignment\nInspect stern tube seals\nVerify bearing wear measurements\nCheck coupling bolts", order: 3 },
  { mesh: "thrust-bearing", name: "Thrust Bearing", system: "Propulsion", desc: "Absorbs propeller thrust and transmits to hull", notes: "Check bearing temperature\nVerify oil level\nInspect thrust pads\nCheck alignment", order: 4 },
  { mesh: "engine-bed", name: "Engine Bed", system: "Propulsion", desc: "Structural foundation for main engine", notes: "Inspect for cracks\nCheck chocking condition\nVerify holding-down bolts\nCheck alignment readings", order: 5 },

  { mesh: "fuel-oil-tank-port", name: "Fuel Oil Tank (Port)", system: "Fuel Oil", desc: "Port side fuel oil storage tank", notes: "Check tank condition\nVerify sounding pipes\nInspect vent pipes\nCheck for leaks at fittings", order: 1 },
  { mesh: "fuel-oil-tank-stbd", name: "Fuel Oil Tank (Starboard)", system: "Fuel Oil", desc: "Starboard fuel oil storage tank", notes: "Check tank condition\nVerify sounding pipes\nInspect vent pipes\nCheck for leaks at fittings", order: 2 },
  { mesh: "fuel-oil-service-pump", name: "Fuel Oil Service Pump", system: "Fuel Oil", desc: "Transfers fuel from storage to service tanks", notes: "Check pump operation\nInspect relief valve\nVerify pressure gauges\nCheck gland packing", order: 3 },
  { mesh: "fuel-oil-purifier", name: "Fuel Oil Purifier", system: "Fuel Oil", desc: "Centrifugal separator for fuel oil purification", notes: "Check purifier operation\nVerify discharge clarity\nInspect bowl and discs\nCheck vibration levels", order: 4 },
  { mesh: "fuel-oil-heater", name: "Fuel Oil Heater", system: "Fuel Oil", desc: "Heats fuel oil to proper viscosity for injection", notes: "Check temperature controls\nInspect heating coils\nVerify safety cutoffs\nCheck for leaks", order: 5 },

  { mesh: "bilge-pump-main", name: "Main Bilge Pump", system: "Bilge", desc: "Primary bilge dewatering pump", notes: "Test pump operation\nCheck suction strainers\nVerify non-return valves\nTest bilge alarm system", order: 1 },
  { mesh: "bilge-pump-emergency", name: "Emergency Bilge Pump", system: "Bilge", desc: "Emergency/backup bilge pump", notes: "Test emergency operation\nVerify independent power supply\nCheck suction lines\nTest from emergency station", order: 2 },
  { mesh: "bilge-well-port", name: "Bilge Well (Port)", system: "Bilge", desc: "Port side bilge collection well", notes: "Check for debris\nVerify suction pipe condition\nInspect strainer plate\nCheck level alarm", order: 3 },
  { mesh: "bilge-well-stbd", name: "Bilge Well (Starboard)", system: "Bilge", desc: "Starboard bilge collection well", notes: "Check for debris\nVerify suction pipe condition\nInspect strainer plate\nCheck level alarm", order: 4 },
  { mesh: "oily-water-separator", name: "Oily Water Separator", system: "Bilge", desc: "Separates oil from bilge water before discharge", notes: "Check 15 ppm alarm\nVerify oil content monitor\nInspect coalescing elements\nCheck overboard valve", order: 5 },

  { mesh: "main-switchboard", name: "Main Switchboard", system: "Electrical", desc: "Main electrical distribution panel", notes: "Check insulation resistance\nVerify protective devices\nInspect bus bars\nCheck ventilation\nVerify labeling", order: 1 },
  { mesh: "emergency-generator", name: "Emergency Generator", system: "Electrical", desc: "Emergency power generation unit", notes: "Test auto-start on blackout\nVerify fuel supply\nCheck starting batteries\nTest emergency loads\nVerify run time", order: 2 },
  { mesh: "shore-connection", name: "Shore Connection", system: "Electrical", desc: "Shore power connection point", notes: "Check connection box condition\nVerify interlock operation\nInspect cable condition\nCheck grounding", order: 3 },
  { mesh: "battery-bank", name: "Battery Bank", system: "Electrical", desc: "Emergency and starting battery bank", notes: "Check electrolyte levels\nVerify charging system\nInspect terminals\nCheck ventilation\nTest capacity", order: 4 },

  { mesh: "exhaust-trunk", name: "Exhaust Trunk", system: "Exhaust", desc: "Main engine exhaust gas trunk", notes: "Check for leaks\nInspect expansion joints\nVerify insulation condition\nCheck support brackets", order: 1 },
  { mesh: "turbocharger", name: "Turbocharger", system: "Exhaust", desc: "Exhaust-gas-driven air compressor for engine", notes: "Check bearing temperature\nVerify oil supply\nInspect for unusual vibration\nCheck turbine-side cleanliness", order: 2 },
  { mesh: "exhaust-silencer", name: "Exhaust Silencer", system: "Exhaust", desc: "Reduces exhaust noise levels", notes: "Check for corrosion\nInspect drain plug\nVerify mounting condition\nCheck spark arrester if fitted", order: 3 },

  { mesh: "sw-cooling-pump", name: "Sea Water Cooling Pump", system: "Cooling Water", desc: "Circulates sea water through heat exchangers", notes: "Check pump operation\nInspect sea chest strainers\nVerify pressure\nCheck impeller condition", order: 1 },
  { mesh: "fw-cooling-pump", name: "Fresh Water Cooling Pump", system: "Cooling Water", desc: "Circulates fresh water through engine jacket", notes: "Check pump operation\nVerify pressure and flow\nInspect mechanical seal\nCheck coolant condition", order: 2 },
  { mesh: "heat-exchanger", name: "Heat Exchanger", system: "Cooling Water", desc: "Transfers heat from fresh water to sea water circuit", notes: "Check for leaks\nVerify temperature differential\nInspect zincs\nCheck tube condition", order: 3 },
  { mesh: "expansion-tank", name: "Expansion Tank", system: "Cooling Water", desc: "Accommodates coolant thermal expansion", notes: "Check water level\nVerify cap/vent\nInspect for contamination\nCheck low-level alarm", order: 4 },

  { mesh: "air-compressor-1", name: "Air Compressor No. 1", system: "Starting Air", desc: "Primary compressed air supply for engine starting", notes: "Check auto-start operation\nVerify safety valve\nInspect unloader valves\nCheck oil level\nTest capacity", order: 1 },
  { mesh: "air-compressor-2", name: "Air Compressor No. 2", system: "Starting Air", desc: "Secondary compressed air supply", notes: "Check auto-start operation\nVerify safety valve\nInspect unloader valves\nCheck oil level\nTest capacity", order: 2 },
  { mesh: "air-receiver", name: "Air Receiver", system: "Starting Air", desc: "Stores compressed air for engine starting", notes: "Check safety valve\nVerify pressure gauge\nInspect drain valve\nCheck for corrosion\nVerify certification", order: 3 },

  { mesh: "co2-bank", name: "CO2 Bank", system: "Fire Safety", desc: "CO2 fire suppression cylinder bank for engine room", notes: "Verify bottle count and weight\nCheck release mechanism\nInspect piping and nozzles\nVerify warning signage\nTest alarm system", order: 1 },
  { mesh: "fire-pump", name: "Fire Pump", system: "Fire Safety", desc: "Main fire pump for fire main system", notes: "Test pump operation\nVerify pressure at hydrants\nCheck relief valve\nInspect suction strainer\nTest emergency start", order: 2 },
];

for (const c of components) {
  const sys = getSystemId.get(c.system) as { id: number };
  insertComp.run(c.mesh, c.name, c.desc, c.notes, sys.id, c.order);
}

// Seed some representative deficiencies
const insertDef = db.prepare(
  "INSERT OR IGNORE INTO component_deficiencies (component_id, code, title, description, severity, cfr_reference, remediation) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

const getCompId = db.prepare("SELECT id FROM components WHERE mesh_name = ?");

const deficiencies = [
  { mesh: "main-engine", code: "ME-001", title: "Foundation bolt looseness", desc: "Engine foundation bolts found loose or missing", severity: "serious", cfr: "46 CFR 58.01", remediation: "Retorque or replace foundation bolts to manufacturer specifications. Verify chocking condition." },
  { mesh: "main-engine", code: "ME-002", title: "Crankcase oil mist", desc: "Excessive oil mist detected in crankcase", severity: "critical", cfr: "46 CFR 58.01", remediation: "Immediately stop engine. Investigate cause — possible bearing failure or piston ring blowby." },
  { mesh: "main-engine", code: "ME-003", title: "Governor malfunction", desc: "Speed governor not maintaining set RPM within limits", severity: "serious", cfr: "46 CFR 58.01", remediation: "Inspect governor linkage and actuator. Calibrate or replace governor per manufacturer instructions." },
  { mesh: "oily-water-separator", code: "OWS-001", title: "15 ppm alarm inoperative", desc: "Oil content monitor alarm not functioning", severity: "critical", cfr: "33 CFR 155.360", remediation: "Repair or replace oil content monitor. Vessel must not discharge bilge water overboard until repaired." },
  { mesh: "oily-water-separator", code: "OWS-002", title: "Bypass valve not sealed", desc: "OWS bypass valve found unsealed or tampered with", severity: "critical", cfr: "33 CFR 155.360", remediation: "Seal bypass valve. Investigate potential unauthorized discharge. Report to COTP." },
  { mesh: "main-switchboard", code: "ELEC-001", title: "Low insulation resistance", desc: "Insulation resistance below minimum standards", severity: "serious", cfr: "46 CFR 111.05", remediation: "Identify affected circuits. Clean, dry, or replace insulation as needed. Retest to verify compliance." },
  { mesh: "main-switchboard", code: "ELEC-002", title: "Missing circuit labeling", desc: "Circuit breakers not properly labeled", severity: "moderate", cfr: "46 CFR 111.05", remediation: "Label all circuit breakers with clear, legible identification per NFPA 70 requirements." },
  { mesh: "emergency-generator", code: "EGEN-001", title: "Auto-start failure", desc: "Emergency generator fails to auto-start on blackout", severity: "critical", cfr: "46 CFR 112.05", remediation: "Troubleshoot starting system — check batteries, fuel supply, and control circuits. Test auto-start to verify." },
  { mesh: "co2-bank", code: "FIRE-001", title: "CO2 bottles underweight", desc: "CO2 cylinders below required charge weight", severity: "critical", cfr: "46 CFR 95.15", remediation: "Recharge or replace underweight cylinders. System must maintain required flooding factor." },
  { mesh: "co2-bank", code: "FIRE-002", title: "Release mechanism defective", desc: "CO2 manual or automatic release mechanism not functioning", severity: "critical", cfr: "46 CFR 95.15", remediation: "Repair or replace release mechanism. Test operation. Verify crew familiarity." },
  { mesh: "fire-pump", code: "FIRE-003", title: "Insufficient pressure", desc: "Fire pump not achieving required pressure at hydrants", severity: "serious", cfr: "46 CFR 95.10", remediation: "Inspect pump impeller, check for air leaks in suction, verify relief valve setting." },
  { mesh: "bilge-pump-main", code: "BILGE-001", title: "Suction strainer clogged", desc: "Bilge pump suction strainers found clogged with debris", severity: "moderate", cfr: "46 CFR 56.50", remediation: "Clean strainers. Implement regular maintenance schedule. Check bilge cleanliness." },
  { mesh: "bilge-pump-emergency", code: "BILGE-002", title: "Emergency pump inoperative", desc: "Emergency bilge pump fails to operate from emergency station", severity: "critical", cfr: "46 CFR 56.50", remediation: "Troubleshoot emergency pump system. Verify independent power supply. Test from all control stations." },
  { mesh: "fuel-oil-tank-port", code: "FUEL-001", title: "Tank vent pipe obstruction", desc: "Fuel oil tank vent pipe found blocked or restricted", severity: "serious", cfr: "46 CFR 56.50", remediation: "Clear obstruction. Inspect flame screen. Verify vent pipe leads to safe location on deck." },
  { mesh: "fuel-oil-purifier", code: "FUEL-002", title: "Excessive water in fuel", desc: "Fuel purifier not adequately removing water content", severity: "moderate", cfr: "46 CFR 56.50", remediation: "Service purifier — clean bowl and disc stack. Check gravity disc sizing. Test discharge quality." },
  { mesh: "sw-cooling-pump", code: "COOL-001", title: "Sea chest strainer fouled", desc: "Sea water cooling pump suction strainer heavily fouled", severity: "moderate", cfr: "46 CFR 56.50", remediation: "Clean sea chest strainer. Inspect valve operation. Check for marine growth buildup." },
  { mesh: "heat-exchanger", code: "COOL-002", title: "Zinc anodes depleted", desc: "Sacrificial zinc anodes in heat exchanger fully consumed", severity: "moderate", cfr: "46 CFR 56.50", remediation: "Replace all zinc anodes. Inspect tube bundle for corrosion damage. Record replacement date." },
  { mesh: "air-receiver", code: "AIR-001", title: "Safety valve malfunction", desc: "Air receiver safety valve fails to lift at set pressure", severity: "critical", cfr: "46 CFR 54.15", remediation: "Replace or recertify safety valve. Verify set pressure matches nameplate. Do not operate with defective safety valve." },
  { mesh: "air-receiver", code: "AIR-002", title: "Excessive moisture", desc: "Air receiver drain reveals excessive water accumulation", severity: "moderate", cfr: "46 CFR 54.15", remediation: "Drain receiver. Check air dryer operation. Inspect compressor intercooler and aftercooler." },
  { mesh: "exhaust-trunk", code: "EXH-001", title: "Insulation deterioration", desc: "Exhaust trunk insulation damaged or missing sections", severity: "moderate", cfr: "46 CFR 58.01", remediation: "Replace damaged insulation. Ensure surface temperature does not exceed 220°F per regulations." },
  { mesh: "turbocharger", code: "EXH-002", title: "Excessive vibration", desc: "Turbocharger vibration levels above manufacturer limits", severity: "serious", cfr: "46 CFR 58.01", remediation: "Inspect rotor balance and bearing condition. Check for turbine blade damage. Clean compressor side if fouled." },
  { mesh: "propeller-shaft", code: "PROP-001", title: "Stern tube seal leakage", desc: "Excessive leakage at stern tube seal", severity: "serious", cfr: "46 CFR 61.20", remediation: "Inspect and replace stern tube seals. Check shaft condition at seal area. Monitor leakage rate." },
];

for (const d of deficiencies) {
  const comp = getCompId.get(d.mesh) as { id: number };
  if (comp) {
    insertDef.run(comp.id, d.code, d.title, d.desc, d.severity, d.cfr, d.remediation);
  }
}

console.log(`Seeded ${systems.length} systems, ${components.length} components, ${deficiencies.length} deficiencies.`);
db.close();

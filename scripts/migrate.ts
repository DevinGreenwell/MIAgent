/**
 * Database migration — creates all tables for MIAgent.
 * Run: npm run migrate
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, "..", "db");
const DB_PATH = path.join(DB_DIR, "miagent.db");

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("Running migrations...");

db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    doc_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    collection_id TEXT NOT NULL REFERENCES collections(id),
    subcategory TEXT,
    year INTEGER,
    revision TEXT,
    status TEXT DEFAULT 'active',
    summary TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection_id);
  CREATE INDEX IF NOT EXISTS idx_documents_year ON documents(year);

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    doc_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS vessel_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    doc_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cfr_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    part TEXT,
    subpart TEXT
  );

  CREATE TABLE IF NOT EXISTS document_topics (
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, topic_id)
  );

  CREATE TABLE IF NOT EXISTS document_vessel_types (
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    vessel_type_id INTEGER NOT NULL REFERENCES vessel_types(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, vessel_type_id)
  );

  CREATE TABLE IF NOT EXISTS document_cfr_sections (
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    cfr_section_id INTEGER NOT NULL REFERENCES cfr_sections(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, cfr_section_id)
  );

  CREATE TABLE IF NOT EXISTS document_relationships (
    source_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT 'related',
    PRIMARY KEY (source_id, target_id)
  );

  CREATE TABLE IF NOT EXISTS document_text (
    document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    extracted_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#999999',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesh_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    inspection_notes TEXT NOT NULL DEFAULT '',
    system_id INTEGER NOT NULL REFERENCES systems(id),
    sort_order INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_components_system ON components(system_id);
  CREATE INDEX IF NOT EXISTS idx_components_mesh ON components(mesh_name);

  CREATE TABLE IF NOT EXISTS component_documents (
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    relevance TEXT NOT NULL DEFAULT 'reference',
    cfr_reference TEXT,
    PRIMARY KEY (component_id, document_id)
  );

  CREATE TABLE IF NOT EXISTS component_deficiencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'moderate',
    cfr_reference TEXT,
    remediation TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

  -- FTS5 virtual table for full-text search
  CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    title, document_id, subcategory,
    content=documents,
    content_rowid=id
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid, title, document_id, subcategory)
    VALUES (new.id, new.title, new.document_id, new.subcategory);
  END;

  CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, title, document_id, subcategory)
    VALUES ('delete', old.id, old.title, old.document_id, old.subcategory);
  END;

  CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, title, document_id, subcategory)
    VALUES ('delete', old.id, old.title, old.document_id, old.subcategory);
    INSERT INTO documents_fts(rowid, title, document_id, subcategory)
    VALUES (new.id, new.title, new.document_id, new.subcategory);
  END;
`);

console.log("Migration complete.");
db.close();

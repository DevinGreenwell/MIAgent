/** Singleton SQLite connection for the server. */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("cache_size = -64000"); // 64 MB page cache
db.pragma("temp_store = MEMORY");

// Performance indexes for common join/filter patterns
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_document_topics_doc ON document_topics(document_id);
  CREATE INDEX IF NOT EXISTS idx_document_topics_topic ON document_topics(topic_id);
  CREATE INDEX IF NOT EXISTS idx_document_vessel_types_doc ON document_vessel_types(document_id);
  CREATE INDEX IF NOT EXISTS idx_document_vessel_types_vt ON document_vessel_types(vessel_type_id);
  CREATE INDEX IF NOT EXISTS idx_document_cfr_sections_doc ON document_cfr_sections(document_id);
  CREATE INDEX IF NOT EXISTS idx_document_cfr_sections_cfr ON document_cfr_sections(cfr_section_id);
`);

// Study content cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS study_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qual_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    topic TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(qual_id, content_type, topic)
  )
`);

// Slideshow image generation session tracking
db.exec(`
  CREATE TABLE IF NOT EXISTS slideshow_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study_content_id INTEGER,
    qual_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    slide_count INTEGER NOT NULL DEFAULT 0,
    images_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (study_content_id) REFERENCES study_content(id) ON DELETE SET NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS slideshow_slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    slide_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    bullets TEXT NOT NULL,
    speaker_notes TEXT,
    citations TEXT,
    image_prompt TEXT,
    image_filename TEXT,
    image_status TEXT NOT NULL DEFAULT 'pending',
    image_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES slideshow_sessions(id) ON DELETE CASCADE
  )
`);

export default db;

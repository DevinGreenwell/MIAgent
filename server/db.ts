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

export default db;

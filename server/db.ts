/** Singleton SQLite connection for the server. */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "db", "miagent.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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

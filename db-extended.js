#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Database location
const DB_DIR = path.join(os.homedir(), '.work-memory');
const DB_PATH = path.join(DB_DIR, 'memory.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Extended schema for session handoff tracking
db.exec(`
  -- Original tables
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    project TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_timestamp ON entries(timestamp);
  CREATE INDEX IF NOT EXISTS idx_type ON entries(type);
  CREATE INDEX IF NOT EXISTS idx_project ON entries(project);

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    summary TEXT,
    tech_stack TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Extended tables for session handoff
  CREATE TABLE IF NOT EXISTS session_handoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_end TEXT NOT NULL,
    duration TEXT,
    summary TEXT,
    files_modified TEXT,
    status TEXT DEFAULT 'completed',
    project TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS commands_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    description TEXT,
    category TEXT,
    success INTEGER DEFAULT 1,
    session_id INTEGER,
    project TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES session_handoffs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_commands_category ON commands_log(category);
  CREATE INDEX IF NOT EXISTS idx_commands_project ON commands_log(project);

  CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    context TEXT,
    solution TEXT,
    alternatives TEXT,
    tradeoffs TEXT,
    category TEXT,
    impact TEXT,
    session_id INTEGER,
    project TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES session_handoffs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_decisions_category ON decisions(category);
  CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project);

  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    severity TEXT,
    status TEXT DEFAULT 'open',
    description TEXT,
    workaround TEXT,
    root_cause TEXT,
    resolution TEXT,
    session_id INTEGER,
    project TEXT,
    resolved_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES session_handoffs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
  CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project);

  CREATE TABLE IF NOT EXISTS current_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT UNIQUE NOT NULL,
    last_updated TEXT NOT NULL,
    completed_recently TEXT,
    in_progress TEXT,
    next_session TEXT,
    important_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = { db, DB_PATH };

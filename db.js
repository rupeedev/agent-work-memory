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

  -- Changelog tracking tables
  CREATE TABLE IF NOT EXISTS changelog_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    version TEXT,
    entry_type TEXT NOT NULL,  -- COMPLETED, PENDING, IN_PROGRESS, FIXED, ADDED, CHANGED, REMOVED
    category TEXT,  -- feature, bugfix, enhancement, documentation, infrastructure
    title TEXT NOT NULL,
    description TEXT,
    metadata TEXT,  -- JSON field for additional data
    date TEXT NOT NULL,
    session_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES session_handoffs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_changelog_project ON changelog_entries(project);
  CREATE INDEX IF NOT EXISTS idx_changelog_type ON changelog_entries(entry_type);
  CREATE INDEX IF NOT EXISTS idx_changelog_version ON changelog_entries(version);
  CREATE INDEX IF NOT EXISTS idx_changelog_date ON changelog_entries(date);

  CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    status TEXT NOT NULL,  -- completed, pending, in_progress, blocked
    priority TEXT,  -- critical, high, medium, low
    description TEXT,
    acceptance_criteria TEXT,
    started_at TEXT,
    completed_at TEXT,
    blocked_reason TEXT,
    session_id INTEGER,
    changelog_entry_id INTEGER,
    tags TEXT,  -- Comma-separated tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES session_handoffs(id),
    FOREIGN KEY (changelog_entry_id) REFERENCES changelog_entries(id)
  );

  CREATE INDEX IF NOT EXISTS idx_features_project ON features(project);
  CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);
  CREATE INDEX IF NOT EXISTS idx_features_priority ON features(priority);

  CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    version TEXT NOT NULL,
    release_date TEXT NOT NULL,
    release_type TEXT,  -- major, minor, patch, phase
    summary TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project, version)
  );

  CREATE INDEX IF NOT EXISTS idx_releases_project ON releases(project);
  CREATE INDEX IF NOT EXISTS idx_releases_date ON releases(release_date);
`);

module.exports = { db, DB_PATH };

/**
 * SQLite schema definition. Every syncable table carries:
 *   server_id  TEXT     -- backend id (UUID; NULL until synced)
 *   is_dirty   INTEGER  -- 1 = local change pending upload
 *   updated_at TEXT     -- ISO timestamp, used for last-write-wins
 *   synced_at  TEXT     -- ISO timestamp of last successful sync
 *
 * Difficulty is constrained to Easy|Medium|Hard.
 * question_sets.subject_id is the PRIMARY driver; course_id is optional.
 */

export const SCHEMA_VERSION = 5;

export const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS subjects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id   TEXT,
    name        TEXT NOT NULL,
    synced_at   TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS courses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id   TEXT,
    name        TEXT NOT NULL,
    exam_type   TEXT,
    synced_at   TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS course_subjects (
    course_id   INTEGER NOT NULL,
    subject_id  INTEGER NOT NULL,
    PRIMARY KEY (course_id, subject_id),
    FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS question_sets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id       TEXT,
    subject_id      INTEGER NOT NULL,
    course_id       INTEGER,
    difficulty      TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
    language        TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','hi')),
    total_questions INTEGER NOT NULL DEFAULT 0,
    generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    is_dirty        INTEGER NOT NULL DEFAULT 1,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at       TEXT,
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (course_id)  REFERENCES courses(id)
  );`,

  `CREATE TABLE IF NOT EXISTS questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id   TEXT,
    set_id      INTEGER NOT NULL,
    text        TEXT NOT NULL,
    explanation TEXT,
    is_dirty    INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at   TEXT,
    FOREIGN KEY (set_id) REFERENCES question_sets(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS options (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id   TEXT,
    question_id INTEGER NOT NULL,
    text        TEXT NOT NULL,
    is_correct  INTEGER NOT NULL DEFAULT 0,
    synced_at   TEXT,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id        TEXT,
    set_id           INTEGER NOT NULL,
    mode             TEXT NOT NULL CHECK (mode IN ('timed','untimed')),
    feedback_mode    TEXT NOT NULL CHECK (feedback_mode IN ('immediate','end')),
    total_questions  INTEGER NOT NULL,
    duration_seconds INTEGER,
    status           TEXT NOT NULL CHECK (status IN ('active','completed','abandoned')),
    score            REAL,
    -- 1 = this test was started from the local bank with no internet (Offline
    -- Test). Device-local only (not synced); lets "Next" mirror the same mode.
    is_offline       INTEGER NOT NULL DEFAULT 0,
    started_at       TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at     TEXT,
    resume_payload   TEXT,
    is_dirty         INTEGER NOT NULL DEFAULT 1,
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at        TEXT,
    FOREIGN KEY (set_id) REFERENCES question_sets(id)
  );`,

  `CREATE TABLE IF NOT EXISTS attempts (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id          TEXT,
    session_id         INTEGER NOT NULL,
    question_id        INTEGER NOT NULL,
    selected_option_id INTEGER,
    is_correct         INTEGER NOT NULL DEFAULT 0,
    time_taken_seconds INTEGER,
    answered_at        TEXT NOT NULL DEFAULT (datetime('now')),
    is_dirty           INTEGER NOT NULL DEFAULT 1,
    synced_at          TEXT,
    FOREIGN KEY (session_id)  REFERENCES sessions(id)  ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );`,

  `CREATE TABLE IF NOT EXISTS analytics (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id             TEXT,
    subject_id            INTEGER,
    course_id             INTEGER,
    difficulty            TEXT,
    total_attempted       INTEGER NOT NULL DEFAULT 0,
    total_correct         INTEGER NOT NULL DEFAULT 0,
    accuracy_percent      REAL NOT NULL DEFAULT 0,
    avg_time_per_question REAL,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at             TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS app_usage (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id      TEXT,
    date           TEXT NOT NULL UNIQUE,
    seconds_active INTEGER NOT NULL DEFAULT 0,
    is_dirty       INTEGER NOT NULL DEFAULT 1,
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at      TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS sync_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,
    entity_id       INTEGER NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('create','update')),
    payload         TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at       TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0
  );`,

  // Tracks the schema version + last full sync timestamp.
  `CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS locations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id       TEXT,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    accuracy        REAL NOT NULL,
    altitude        REAL,
    speed           REAL,
    heading         REAL,
    recorded_at     TEXT NOT NULL,
    location_source TEXT NOT NULL DEFAULT 'gps' CHECK (location_source IN ('gps','network','fused')),
    battery_level   INTEGER,
    is_dirty        INTEGER NOT NULL DEFAULT 1,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at       TEXT
  );`,
];

export const CREATE_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_qsets_subject ON question_sets(subject_id, difficulty);`,
  `CREATE INDEX IF NOT EXISTS idx_questions_set ON questions(set_id);`,
  `CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);`,
  `CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);`,
  `CREATE INDEX IF NOT EXISTS idx_locations_recorded_at ON locations(recorded_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_locations_dirty ON locations(is_dirty);`,
];

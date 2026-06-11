-- NextRouter Schema Initialization

CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    workspace_path TEXT,
    last_scanned_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    title TEXT,
    started_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    status TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    captured_at TEXT NOT NULL,
    files_count INTEGER DEFAULT 0,
    tokens_count INTEGER DEFAULT 0,
    data TEXT NOT NULL, -- JSON representation of context data
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    last_updated_at TEXT NOT NULL,
    hash TEXT NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS handover_packets (
    id TEXT PRIMARY KEY,
    source_provider_id TEXT NOT NULL,
    source_session_id TEXT,
    target_provider_id TEXT,
    created_at TEXT NOT NULL,
    summary TEXT NOT NULL,
    files TEXT NOT NULL, -- JSON list of file states
    raw_markdown TEXT NOT NULL,
    FOREIGN KEY (source_provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    session_id TEXT,
    direction TEXT NOT NULL, -- 'input' | 'output'
    tokens INTEGER NOT NULL,
    cost REAL DEFAULT 0.0,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT, -- JSON string array
    auto_inject INTEGER DEFAULT 0, -- 0 = false, 1 = true
    last_updated_at TEXT NOT NULL
);

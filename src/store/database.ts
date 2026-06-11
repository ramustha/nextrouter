import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ProviderRow {
  id: string;
  name: string;
  status: string;
  workspace_path?: string;
  last_scanned_at?: string;
}

export interface SessionRow {
  id: string;
  provider_id: string;
  title: string;
  started_at: string;
  last_active_at: string;
  status: string;
  token_count: number;
  messages: any[]; // JSON serialized
}

export interface ContextSnapshotRow {
  id: string;
  session_id?: string;
  captured_at: string;
  files_count: number;
  tokens_count: number;
  data: string; // JSON serialized
}

export interface RuleRow {
  id: string;
  provider_id: string;
  filename: string;
  content: string;
  last_updated_at: string;
  hash: string;
}

export interface HandoverPacketRow {
  id: string;
  source_provider_id: string;
  source_session_id?: string;
  target_provider_id?: string;
  created_at: string;
  summary: string;
  files: string; // JSON serialized
  raw_markdown: string;
}

export interface TokenUsageRow {
  id: number;
  provider_id: string;
  session_id?: string;
  direction: 'input' | 'output';
  tokens: number;
  cost: number;
  timestamp: string;
}

export interface SkillRow {
  id: string;
  name: string;
  version: string;
  content: string;
  tags?: string; // JSON serialized array
  auto_inject: number; // 0 | 1
  last_updated_at: string;
}

export interface DatabaseSchema {
  providers: ProviderRow[];
  sessions: SessionRow[];
  context_snapshots: ContextSnapshotRow[];
  rules: RuleRow[];
  handover_packets: HandoverPacketRow[];
  token_usage: TokenUsageRow[];
  skills: SkillRow[];
}

let dbInstance: JsonDatabase | null = null;

class JsonDatabase {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse database file, initializing empty:', e);
      }
    }

    // Initialize defaults
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const defaultData: DatabaseSchema = {
      providers: [
        { id: 'claude-code', name: 'Claude Code', status: 'inactive' },
        { id: 'cursor', name: 'Cursor', status: 'inactive' },
        { id: 'antigravity', name: 'Antigravity', status: 'inactive' },
        { id: 'copilot', name: 'GitHub Copilot', status: 'inactive' }
      ],
      sessions: [],
      context_snapshots: [],
      rules: [],
      handover_packets: [],
      token_usage: [],
      skills: []
    };

    this.saveData(defaultData);
    return defaultData;
  }

  private saveData(data: DatabaseSchema) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write database file:', e);
    }
  }

  private persist() {
    this.saveData(this.data);
  }

  // TABLE METHODS
  
  // Providers
  get providers() {
    return {
      all: () => this.data.providers,
      get: (id: string) => this.data.providers.find(p => p.id === id),
      upsert: (provider: ProviderRow) => {
        const idx = this.data.providers.findIndex(p => p.id === provider.id);
        if (idx >= 0) {
          this.data.providers[idx] = { ...this.data.providers[idx], ...provider };
        } else {
          this.data.providers.push(provider);
        }
        this.persist();
      }
    };
  }

  // Sessions
  get sessions() {
    return {
      all: () => this.data.sessions,
      get: (id: string) => this.data.sessions.find(s => s.id === id),
      upsert: (session: SessionRow) => {
        const idx = this.data.sessions.findIndex(s => s.id === session.id);
        if (idx >= 0) {
          this.data.sessions[idx] = { ...this.data.sessions[idx], ...session };
        } else {
          this.data.sessions.push(session);
        }
        this.persist();
      },
      delete: (id: string) => {
        this.data.sessions = this.data.sessions.filter(s => s.id !== id);
        this.persist();
      }
    };
  }

  // Snapshots
  get snapshots() {
    return {
      all: () => this.data.context_snapshots,
      get: (id: string) => this.data.context_snapshots.find(s => s.id === id),
      insert: (snapshot: ContextSnapshotRow) => {
        this.data.context_snapshots.push(snapshot);
        this.persist();
      },
      delete: (id: string) => {
        this.data.context_snapshots = this.data.context_snapshots.filter(s => s.id !== id);
        this.persist();
      }
    };
  }

  // Rules
  get rules() {
    return {
      all: () => this.data.rules,
      get: (id: string) => this.data.rules.find(r => r.id === id),
      upsert: (rule: RuleRow) => {
        const idx = this.data.rules.findIndex(r => r.id === rule.id);
        if (idx >= 0) {
          this.data.rules[idx] = { ...this.data.rules[idx], ...rule };
        } else {
          this.data.rules.push(rule);
        }
        this.persist();
      },
      delete: (id: string) => {
        this.data.rules = this.data.rules.filter(r => r.id !== id);
        this.persist();
      }
    };
  }

  // Handover Packets
  get handoverPackets() {
    return {
      all: () => this.data.handover_packets,
      get: (id: string) => this.data.handover_packets.find(h => h.id === id),
      insert: (packet: HandoverPacketRow) => {
        this.data.handover_packets.push(packet);
        this.persist();
      }
    };
  }

  // Token Usage
  get tokenUsage() {
    return {
      all: () => this.data.token_usage,
      insert: (usage: Omit<TokenUsageRow, 'id'>) => {
        const id = this.data.token_usage.length > 0 
          ? Math.max(...this.data.token_usage.map(t => t.id)) + 1 
          : 1;
        this.data.token_usage.push({ ...usage, id });
        this.persist();
      }
    };
  }

  // Skills
  get skills() {
    return {
      all: () => this.data.skills,
      get: (id: string) => this.data.skills.find(s => s.id === id),
      upsert: (skill: SkillRow) => {
        const idx = this.data.skills.findIndex(s => s.id === skill.id);
        if (idx >= 0) {
          this.data.skills[idx] = { ...this.data.skills[idx], ...skill };
        } else {
          this.data.skills.push(skill);
        }
        this.persist();
      },
      delete: (id: string) => {
        this.data.skills = this.data.skills.filter(s => s.id !== id);
        this.persist();
      }
    };
  }
}

export function getDatabasePath(): string {
  let currentDir = process.cwd();
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      const dataDir = path.join(currentDir, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      return path.join(dataDir, 'db.json');
    }
    currentDir = path.dirname(currentDir);
  }
  
  const fallbackDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(fallbackDir)) {
    fs.mkdirSync(fallbackDir, { recursive: true });
  }
  return path.join(fallbackDir, 'db.json');
}

export function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }
  const dbPath = getDatabasePath();
  dbInstance = new JsonDatabase(dbPath);
  return dbInstance;
}

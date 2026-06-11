export interface RuleFile {
  id: string; // unique ID
  filename: string; // e.g. 'CLAUDE.md' or '.cursorrules'
  content: string;
  lastUpdatedAt: string;
  hash: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  tokens?: number;
}

export interface Session {
  id: string;
  title: string;
  startedAt: string;
  lastActiveAt: string;
  status: 'active' | 'archived';
  tokenCount: number;
  messages: Message[];
  workspacePath?: string;
}

export interface ContextMetrics {
  totalTokens: number;
  totalFiles: number;
  filesSizeLimit?: number;
  budgetUsedPercent: number; // percentage of target context window
  contextWindowLimit?: number; // total context window limit size
}

export interface HandoverPacket {
  id: string;
  sourceProviderId: string;
  sourceSessionId?: string;
  targetProviderId?: string;
  createdAt: string;
  summary: string;
  files: Array<{
    path: string;
    description?: string;
    tokens?: number;
  }>;
  rawMarkdown: string;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  
  detect(workspacePath: string): Promise<boolean>;
  getRules(workspacePath: string): Promise<RuleFile[]>;
  writeRules(workspacePath: string, rules: RuleFile[]): Promise<void>;
  
  getSessions(workspacePath: string): Promise<Session[]>;
  getContextSize(workspacePath: string): Promise<ContextMetrics>;
  getHandoverContext(workspacePath: string, sessionId?: string): Promise<HandoverPacket>;
}

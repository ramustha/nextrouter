import { ProviderAdapter, RuleFile, Session, ContextMetrics, HandoverPacket, Message } from './types';
import { calculateRateLimits, findWorkspaceRoot } from './utils';
import { getDatabase } from '../store/database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';
import { getEncoding } from 'js-tiktoken';
import { getGitWorktrees } from '../git/git-helper';

function getSqliteExecutable(): string {
  if (os.platform() === 'win32') {
    const cwdLocalPath = path.join(process.cwd(), 'bin', 'sqlite3.exe');
    if (fs.existsSync(cwdLocalPath)) {
      return `"${cwdLocalPath}"`;
    }
    const relativePath = path.join(__dirname, '..', '..', 'bin', 'sqlite3.exe');
    if (fs.existsSync(relativePath)) {
      return `"${relativePath}"`;
    }
  }
  return 'sqlite3';
}

export class CursorAdapter implements ProviderAdapter {
  id = 'cursor';
  name = 'Cursor';

  private runSqliteQuery(dbPath: string, query: string, maxBuffer?: number): string {
    const sqlite = getSqliteExecutable();
    try {
      const cmd = `${sqlite} "${dbPath}" "${query}"`;
      return execSync(cmd, { 
        encoding: 'utf8', 
        maxBuffer: maxBuffer,
        stdio: ['pipe', 'pipe', 'ignore'] 
      });
    } catch (e: any) {
      if (os.platform() === 'win32') {
        const localPath = path.join(process.cwd(), 'bin', 'sqlite3.exe');
        const relativePath = path.join(__dirname, '..', '..', 'bin', 'sqlite3.exe');
        if (!fs.existsSync(localPath) && !fs.existsSync(relativePath)) {
          console.warn('WARNING: SQLite3 is not installed or available. Please run "npm run setup:windows" to set up SQLite3 on Windows.');
        }
      }
      throw e;
    }
  }

  private getUserDataDir(): string {
    const platform = os.platform();
    if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User');
    } else if (platform === 'win32') {
      return path.join(process.env.APPDATA || '', 'Cursor', 'User');
    } else {
      return path.join(os.homedir(), '.config', 'Cursor', 'User');
    }
  }

  async detect(workspacePath: string): Promise<boolean> {
    const hasRules = fs.existsSync(path.join(workspacePath, '.cursorrules')) || 
                    fs.existsSync(path.join(workspacePath, '.cursor', 'rules'));
    const hasStorage = fs.existsSync(path.join(this.getUserDataDir(), 'workspaceStorage'));
    return hasRules || hasStorage;
  }

  async getRules(workspacePath: string): Promise<RuleFile[]> {
    const rules: RuleFile[] = [];
    const legacyPath = path.join(workspacePath, '.cursorrules');
    
    if (fs.existsSync(legacyPath)) {
      try {
        const content = fs.readFileSync(legacyPath, 'utf8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const stats = fs.statSync(legacyPath);
        rules.push({
          id: `${this.id}-legacy`,
          filename: '.cursorrules',
          content,
          lastUpdatedAt: stats.mtime.toISOString(),
          hash
        });
      } catch (e) {
        console.error('Error reading .cursorrules:', e);
      }
    }

    const rulesDir = path.join(workspacePath, '.cursor', 'rules');
    if (fs.existsSync(rulesDir)) {
      try {
        const files = fs.readdirSync(rulesDir);
        for (const file of files) {
          if (file.endsWith('.mdc') || file.endsWith('.md')) {
            const filePath = path.join(rulesDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            const stats = fs.statSync(filePath);
            rules.push({
              id: `${this.id}-${file}`,
              filename: `.cursor/rules/${file}`,
              content,
              lastUpdatedAt: stats.mtime.toISOString(),
              hash
            });
          }
        }
      } catch (e) {
        console.error('Error reading .cursor/rules:', e);
      }
    }

    return rules;
  }

  async writeRules(workspacePath: string, rules: RuleFile[]): Promise<void> {
    for (const rule of rules) {
      try {
        if (rule.filename === '.cursorrules') {
          const dest = path.join(workspacePath, '.cursorrules');
          fs.writeFileSync(dest, rule.content, 'utf8');
        } else if (rule.filename.startsWith('.cursor/rules/')) {
          const dest = path.join(workspacePath, rule.filename);
          const dir = path.dirname(dest);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(dest, rule.content, 'utf8');
        }
      } catch (e) {
        console.error(`Error writing rule ${rule.filename}:`, e);
      }
    }
  }

  private getWorkspacePathsMap(): Record<string, string> {
    const globalDbPath = path.join(this.getUserDataDir(), 'globalStorage', 'state.vscdb');
    if (!fs.existsSync(globalDbPath)) return {};

    try {
      const stats = fs.statSync(globalDbPath);
      const mtime = stats.mtimeMs;
      
      const cached = (globalThis as any)._cursorWorkspacePathsMapCached;
      if (cached && cached.mtime === mtime) {
        return { ...cached.map };
      }

      const map: Record<string, string> = {};
      const query = `SELECT value FROM itemTable WHERE key = 'history.recentlyOpenedPathsList';`;
      const output = this.runSqliteQuery(globalDbPath, query).trim();
      if (output) {
        const parsed = JSON.parse(output);
        if (parsed && Array.isArray(parsed.entries)) {
          for (const entry of parsed.entries) {
            const uri = entry.folderUri || entry.fileUri || '';
            if (uri.startsWith('file://')) {
              const decodedPath = decodeURIComponent(uri.replace(/^file:\/\//, ''));
              const md5 = crypto.createHash('md5').update(decodedPath).digest('hex');
              map[md5] = decodedPath;
            }
          }
        }
      }
      (globalThis as any)._cursorWorkspacePathsMapCached = { mtime, map };
      return { ...map };
    } catch (e) {
      console.error('Error resolving workspace paths map:', e);
      return {};
    }
  }

  private getChatsDir(): string {
    return path.join(os.homedir(), '.cursor', 'chats');
  }

  async getSessions(workspacePath: string): Promise<Session[]> {
    const chatsDir = this.getChatsDir();
    if (!fs.existsSync(chatsDir)) return [];

    const sessions: Session[] = [];
    
    // Retrieve persistent sessions cache from globalThis
    const globalCursorCache = (globalThis as any)._cursorSessionsCache || new Map<string, Session>();
    (globalThis as any)._cursorSessionsCache = globalCursorCache;

    // Pre-populate memory cache from local DB on cold start
    if (globalCursorCache.size === 0) {
      try {
        const db = getDatabase();
        const dbSessions = db.sessions.all().filter(s => s.provider_id === 'cursor');
        for (const s of dbSessions) {
          const cacheKey = `${s.id}-${s.last_active_at}`;
          globalCursorCache.set(cacheKey, {
            id: s.id,
            title: s.title,
            startedAt: s.started_at,
            lastActiveAt: s.last_active_at,
            status: s.status as any,
            tokenCount: s.token_count,
            messages: s.messages,
            workspacePath: s.workspace_path
          });
        }
      } catch (e) {
        // Ignore DB read errors
      }
    }

    const pathsMap = this.getWorkspacePathsMap();
    
    // Retrieve global workspace paths cache to avoid re-scanning
    const globalWorkspacePathsCache = (globalThis as any)._cursorWorkspacePathsCache || new Map<string, string>();
    (globalThis as any)._cursorWorkspacePathsCache = globalWorkspacePathsCache;

    // Merge cached paths
    for (const [hash, resolvedPath] of globalWorkspacePathsCache.entries()) {
      if (!pathsMap[hash]) {
        pathsMap[hash] = resolvedPath;
      }
    }

    // Pre-populate with current workspace and all its git worktrees to be sure they resolve
    const worktrees = getGitWorktrees(workspacePath);
    for (const wt of worktrees) {
      const resolvedWt = path.resolve(wt);
      const wtMd5 = crypto.createHash('md5').update(resolvedWt).digest('hex');
      pathsMap[wtMd5] = resolvedWt;
      globalWorkspacePathsCache.set(wtMd5, resolvedWt);
    }

    let enc: any;
    try {
      enc = getEncoding('cl100k_base');
    } catch (e) {
      // Fallback
    }

    try {
      const workspaceHashes = fs.readdirSync(chatsDir);
      for (const workspaceHash of workspaceHashes) {
        if (workspaceHash === '.DS_Store') continue;
        const hashPath = path.join(chatsDir, workspaceHash);
        if (!fs.statSync(hashPath).isDirectory()) continue;

        let resolvedWorkspacePath = pathsMap[workspaceHash] || '';
        if (!resolvedWorkspacePath) {
          const sessionUuids = fs.readdirSync(hashPath);
          for (const uuid of sessionUuids) {
            if (uuid === '.DS_Store') continue;
            const dbPath = path.join(hashPath, uuid, 'store.db');
            if (fs.existsSync(dbPath)) {
              try {
                const metaQuery = `SELECT value FROM meta;`;
                const metaHex = this.runSqliteQuery(dbPath, metaQuery).trim();
                if (metaHex) {
                  const meta = JSON.parse(Buffer.from(metaHex, 'hex').toString('utf8'));
                  if (meta.currentPlanUri && typeof meta.currentPlanUri === 'string') {
                    const cleanPath = decodeURIComponent(meta.currentPlanUri.replace(/^file:\/\//, ''));
                    const root = findWorkspaceRoot(cleanPath);
                    if (root) {
                      resolvedWorkspacePath = root;
                      pathsMap[workspaceHash] = root;
                      globalWorkspacePathsCache.set(workspaceHash, root);
                      break;
                    }
                  }
                }
                
                const blobsQuery = `SELECT hex(data) FROM blobs ORDER BY rowid;`;
                const blobsHex = this.runSqliteQuery(dbPath, blobsQuery, 10 * 1024 * 1024);
                const lines = blobsHex.split('\n').filter(l => l.trim() !== '');
                for (const line of lines) {
                  const text = Buffer.from(line, 'hex').toString('utf8');
                  if (text.startsWith('{"role":')) {
                    const obj = JSON.parse(text);
                    if (obj.role === 'user' && typeof obj.content === 'string') {
                      const match = obj.content.match(/Workspace Path:\s*([^\n]+)/);
                      if (match) {
                        const root = findWorkspaceRoot(match[1].trim());
                        if (root) {
                          resolvedWorkspacePath = root;
                          pathsMap[workspaceHash] = root;
                          globalWorkspacePathsCache.set(workspaceHash, root);
                          break;
                        }
                      }
                    }
                  }
                }
                if (resolvedWorkspacePath) break;
              } catch (e) {
                // Ignore errors
              }
            }
          }
        }

        const workspaceName = resolvedWorkspacePath ? path.basename(resolvedWorkspacePath) : `Workspace-${workspaceHash.substring(0, 6)}`;

        const sessionUuids = fs.readdirSync(hashPath);
        for (const uuid of sessionUuids) {
          if (uuid === '.DS_Store') continue;
          const sessionPath = path.join(hashPath, uuid);
          if (!fs.statSync(sessionPath).isDirectory()) continue;

          const dbPath = path.join(sessionPath, 'store.db');
          if (!fs.existsSync(dbPath)) continue;

          try {
            const stats = fs.statSync(dbPath);
            const lastActiveAt = stats.mtime.toISOString();
            
            // Query persistent cache on globalThis
            const globalCursorCache = (globalThis as any)._cursorSessionsCache || new Map<string, Session>();
            (globalThis as any)._cursorSessionsCache = globalCursorCache;

            const cacheKey = `${uuid}-${lastActiveAt}`;
            const cachedSession = globalCursorCache.get(cacheKey);
            if (cachedSession) {
              sessions.push(cachedSession);
              continue;
            }

            // Read meta table
            const metaQuery = `SELECT value FROM meta;`;
            const metaHex = this.runSqliteQuery(dbPath, metaQuery).trim();
            if (!metaHex) continue;

            const metaJson = Buffer.from(metaHex, 'hex').toString('utf8');
            const meta = JSON.parse(metaJson);

            // Read blobs table ordered by rowid
            const blobsQuery = `SELECT hex(data) FROM blobs ORDER BY rowid;`;
            const blobsHex = this.runSqliteQuery(dbPath, blobsQuery, 15 * 1024 * 1024);
            
            const lines = blobsHex.split('\n').filter(l => l.trim() !== '');
            const messages: Message[] = [];
            let tokenCount = 0;
            const startedAt = meta.createdAt ? new Date(meta.createdAt).toISOString() : lastActiveAt;

            for (const line of lines) {
              const buffer = Buffer.from(line, 'hex');
              const text = buffer.toString('utf8');
              
              if (text.startsWith('{"role":')) {
                try {
                  const obj = JSON.parse(text);
                  if (obj.role === 'user' || obj.role === 'assistant') {
                    let contentText = '';
                    if (typeof obj.content === 'string') {
                      contentText = obj.content;
                    } else if (Array.isArray(obj.content)) {
                      contentText = obj.content.map((c: any) => c.text || '').join('');
                    }

                    if (contentText) {
                      const tokens = enc ? enc.encode(contentText).length : Math.ceil(contentText.split(/\s+/).length * 1.3);
                      tokenCount += tokens;

                      messages.push({
                        role: obj.role,
                        content: contentText,
                        tokens
                      });
                    }
                  }
                } catch (e) {
                  // Ignore JSON parse errors
                }
              }
            }

            if (messages.length > 0) {
              // Interpolate message timestamps linearly between startedAt and lastActiveAt
              const startMs = new Date(startedAt).getTime();
              const endMs = new Date(lastActiveAt).getTime();
              const msgCount = messages.length;
              for (let i = 0; i < msgCount; i++) {
                const estTime = msgCount > 1
                  ? startMs + (endMs - startMs) * (i / (msgCount - 1))
                  : endMs;
                messages[i].timestamp = new Date(estTime).toISOString();
              }

              const title = `[${workspaceName}] ${meta.name || 'Cursor Session'}`;
              const sessionObj: Session = {
                id: uuid,
                title,
                startedAt,
                lastActiveAt,
                status: 'active',
                tokenCount,
                messages,
                workspacePath: resolvedWorkspacePath || undefined
              };
              const globalCursorCache = (globalThis as any)._cursorSessionsCache;
              if (globalCursorCache) {
                const cacheKey = `${uuid}-${lastActiveAt}`;
                globalCursorCache.set(cacheKey, sessionObj);
              }
              sessions.push(sessionObj);
            }
          } catch (e) {
            // Ignore individual session errors
          }
        }
      }
    } catch (e) {
      console.error('Error reading Cursor chats:', e);
    }

    return sessions.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  async getContextSize(workspacePath: string): Promise<ContextMetrics> {
    const sessions = await this.getSessions(workspacePath);
    const worktrees = getGitWorktrees(workspacePath).map(p => path.resolve(p));
    const workspaceSessions = sessions.filter(s => 
      s.workspacePath && worktrees.includes(path.resolve(s.workspacePath))
    );
    const totalTokens = workspaceSessions.length > 0 ? workspaceSessions[0].tokenCount : 0;
    
    // Cursor models default context limit (like GPT-4o)
    const limit = 128000;
    const percent = Math.min(100, Math.round((totalTokens / limit) * 100));

    const rateLimits = calculateRateLimits(sessions, 30, 125);

    return {
      totalTokens,
      totalFiles: 0,
      budgetUsedPercent: percent,
      contextWindowLimit: limit,
      ...rateLimits
    };
  }

  async getHandoverContext(workspacePath: string, sessionId?: string): Promise<HandoverPacket> {
    const sessions = await this.getSessions(workspacePath);
    let session = sessions[0]; // default to most recent
    
    if (sessionId) {
      session = sessions.find(s => s.id === sessionId) || session;
    }

    if (!session) {
      return {
        id: crypto.randomUUID(),
        sourceProviderId: this.id,
        createdAt: new Date().toISOString(),
        summary: 'No active session found',
        files: [],
        rawMarkdown: '# No Session Data\n'
      };
    }

    const recentMessages = session.messages.slice(-5);
    const messageHistoryText = recentMessages
      .map(m => `### ${m.role === 'user' ? 'User' : 'Assistant'}\n${m.content}`)
      .join('\n\n');

    const rawMarkdown = `# Cursor Session Handover
**Session Title:** ${session.title}
**Provider Source:** Cursor
**Session ID:** ${session.id}
**Last Active:** ${session.lastActiveAt}
**Total Session Tokens:** ${session.tokenCount}

## Active Task Context
This context is compiled from the last few turns of the conversation:

${messageHistoryText}

## Resuming Work
Copy this handover markdown or load NextRouter's MCP resource into your next provider to resume work.
`;

    return {
      id: crypto.randomUUID(),
      sourceProviderId: this.id,
      sourceSessionId: session.id,
      createdAt: new Date().toISOString(),
      summary: session.title,
      files: [],
      rawMarkdown
    };
  }
}

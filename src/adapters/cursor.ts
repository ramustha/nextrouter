import { ProviderAdapter, RuleFile, Session, ContextMetrics, HandoverPacket, Message } from './types';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';
import { getEncoding } from 'js-tiktoken';

function findWorkspaceRoot(filePath: string): string | null {
  try {
    let currentDir = filePath;
    if (fs.existsSync(currentDir) && !fs.statSync(currentDir).isDirectory()) {
      currentDir = path.dirname(currentDir);
    }
    const root = path.parse(currentDir).root;
    while (currentDir && currentDir !== root) {
      if (
        fs.existsSync(path.join(currentDir, 'package.json')) ||
        fs.existsSync(path.join(currentDir, '.git')) ||
        fs.existsSync(path.join(currentDir, 'CLAUDE.md')) ||
        fs.existsSync(path.join(currentDir, '.cursorrules')) ||
        fs.existsSync(path.join(currentDir, '.claude'))
      ) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
  } catch (e) {
    // Ignore filesystem errors and fallback to string parsing
  }

  // Fallback: heuristic path parsing
  const homedir = os.homedir();
  if (filePath.startsWith(homedir)) {
    const relative = path.relative(homedir, filePath);
    const segments = relative.split(path.sep);
    if (segments[0] === 'Work') {
      if (segments.length >= 3) {
        if (['growth', 'payment', 'personal'].includes(segments[1])) {
          if (segments[1] === 'growth' && ['traffic', 'seo', 'affiliate'].includes(segments[2])) {
            return path.join(homedir, 'Work', segments[1], segments[2], segments[3] || '');
          }
          return path.join(homedir, 'Work', segments[1], segments[2] || '');
        }
        return path.join(homedir, 'Work', segments[1] || '');
      }
    }
    if (segments.length >= 2) {
      return path.join(homedir, segments[0], segments[1]);
    } else if (segments.length === 1) {
      return path.join(homedir, segments[0]);
    }
  }
  return null;
}

export class CursorAdapter implements ProviderAdapter {
  id = 'cursor';
  name = 'Cursor';

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
    const map: Record<string, string> = {};
    const globalDbPath = path.join(this.getUserDataDir(), 'globalStorage', 'state.vscdb');
    if (!fs.existsSync(globalDbPath)) return map;

    try {
      const query = `SELECT value FROM itemTable WHERE key = 'history.recentlyOpenedPathsList';`;
      const cmd = `sqlite3 "${globalDbPath}" "${query}"`;
      const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
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
    } catch (e) {
      console.error('Error resolving workspace paths map:', e);
    }
    return map;
  }

  private getChatsDir(): string {
    return path.join(os.homedir(), '.cursor', 'chats');
  }

  async getSessions(workspacePath: string): Promise<Session[]> {
    const chatsDir = this.getChatsDir();
    if (!fs.existsSync(chatsDir)) return [];

    const sessions: Session[] = [];
    const pathsMap = this.getWorkspacePathsMap();
    
    // Pre-populate with current workspace path to be sure it resolves
    const currentWorkspaceMd5 = crypto.createHash('md5').update(path.resolve(workspacePath)).digest('hex');
    pathsMap[currentWorkspaceMd5] = path.resolve(workspacePath);

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
                const metaHex = execSync(`sqlite3 "${dbPath}" "${metaQuery}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
                if (metaHex) {
                  const meta = JSON.parse(Buffer.from(metaHex, 'hex').toString('utf8'));
                  if (meta.currentPlanUri && typeof meta.currentPlanUri === 'string') {
                    const cleanPath = decodeURIComponent(meta.currentPlanUri.replace(/^file:\/\//, ''));
                    const root = findWorkspaceRoot(cleanPath);
                    if (root) {
                      resolvedWorkspacePath = root;
                      pathsMap[workspaceHash] = root;
                      break;
                    }
                  }
                }
                
                const blobsQuery = `SELECT hex(data) FROM blobs ORDER BY rowid;`;
                const blobsHex = execSync(`sqlite3 "${dbPath}" "${blobsQuery}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] });
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
            // Read meta table
            const metaQuery = `SELECT value FROM meta;`;
            const metaCmd = `sqlite3 "${dbPath}" "${metaQuery}"`;
            const metaHex = execSync(metaCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
            if (!metaHex) continue;

            const metaJson = Buffer.from(metaHex, 'hex').toString('utf8');
            const meta = JSON.parse(metaJson);

            // Read blobs table ordered by rowid
            const blobsQuery = `SELECT hex(data) FROM blobs ORDER BY rowid;`;
            const blobsCmd = `sqlite3 "${dbPath}" "${blobsQuery}"`;
            const blobsHex = execSync(blobsCmd, { encoding: 'utf8', maxBuffer: 15 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] });
            
            const lines = blobsHex.split('\n').filter(l => l.trim() !== '');
            const messages: Message[] = [];
            let tokenCount = 0;

            const stats = fs.statSync(dbPath);
            const lastActiveAt = stats.mtime.toISOString();
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
              const title = `[${workspaceName}] ${meta.name || 'Cursor Session'}`;
              sessions.push({
                id: uuid,
                title,
                startedAt,
                lastActiveAt,
                status: 'active',
                tokenCount,
                messages,
                workspacePath: resolvedWorkspacePath || undefined
              });
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
    const totalTokens = sessions.length > 0 ? sessions[0].tokenCount : 0;
    
    // Cursor models default context limit (like GPT-4o)
    const limit = 128000;
    const percent = Math.min(100, Math.round((totalTokens / limit) * 100));

    return {
      totalTokens,
      totalFiles: 0,
      budgetUsedPercent: percent,
      contextWindowLimit: limit
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

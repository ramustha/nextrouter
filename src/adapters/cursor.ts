import { ProviderAdapter, RuleFile, Session, ContextMetrics, HandoverPacket, Message } from './types';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';
import { getEncoding } from 'js-tiktoken';

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

  private findWorkspaceStoragePath(workspacePath: string): string | null {
    const userDir = this.getUserDataDir();
    const storageDir = path.join(userDir, 'workspaceStorage');
    if (!fs.existsSync(storageDir)) return null;

    try {
      const folders = fs.readdirSync(storageDir);
      for (const folder of folders) {
        const workspaceJsonPath = path.join(storageDir, folder, 'workspace.json');
        if (fs.existsSync(workspaceJsonPath)) {
          const workspaceJson = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf8'));
          const folderUri = workspaceJson.folder || '';
          const resolvedUriPath = decodeURIComponent(folderUri.replace(/^file:\/\//, ''));
          
          if (path.resolve(resolvedUriPath) === path.resolve(workspacePath)) {
            return path.join(storageDir, folder);
          }
        }
      }
    } catch (e) {
      console.error('Error searching Cursor workspaceStorage:', e);
    }
    return null;
  }

  async getSessions(workspacePath: string): Promise<Session[]> {
    const storagePath = this.findWorkspaceStoragePath(workspacePath);
    if (!storagePath) return [];

    const dbPath = path.join(storagePath, 'state.vscdb');
    if (!fs.existsSync(dbPath)) return [];

    const sessions: Session[] = [];
    let enc;
    try {
      enc = getEncoding('cl100k_base');
    } catch (e) {
      console.error('Tiktoken load error, falling back to approximation:', e);
    }

    try {
      // Query the database using system command line tool sqlite3 (which is guaranteed to exist on macOS/Linux)
      // On Windows, if sqlite3 CLI isn't installed, this will fallback gracefully.
      const query = `SELECT key, value FROM itemTable WHERE key LIKE '%composer%' OR key LIKE '%chat%';`;
      const cmd = `sqlite3 "${dbPath}" "${query}"`;
      const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      
      const lines = output.split('\n');
      for (const line of lines) {
        if (!line.includes('|')) continue;
        const dividerIdx = line.indexOf('|');
        const key = line.substring(0, dividerIdx);
        const val = line.substring(dividerIdx + 1);

        // We are interested in composerData or chat state keys
        if (key.includes('composer.composerData') || key.includes('composerData') || key.includes('workbench.panel.chat.state')) {
          try {
            const data = JSON.parse(val);
            // Parse Composer sessions
            if (data && Array.isArray(data.composers)) {
              for (const comp of data.composers) {
                if (!comp.conversation || !Array.isArray(comp.conversation.bubbles)) continue;
                
                const messages: Message[] = [];
                let startedAt = comp.createdAt ? new Date(comp.createdAt).toISOString() : new Date().toISOString();
                let lastActiveAt = comp.updatedAt ? new Date(comp.updatedAt).toISOString() : startedAt;
                let title = comp.name || 'Cursor Composer Session';
                let tokenCount = 0;

                for (const bubble of comp.conversation.bubbles) {
                  const role = bubble.type === 'ai' ? 'assistant' : 'user';
                  const text = bubble.text || '';
                  if (!text) continue;

                  const tokens = enc ? enc.encode(text).length : Math.ceil(text.split(/\s+/).length * 1.3);
                  tokenCount += tokens;

                  messages.push({
                    role,
                    content: text,
                    timestamp: bubble.createdAt ? new Date(bubble.createdAt).toISOString() : undefined,
                    tokens
                  });
                }

                if (messages.length > 0) {
                  sessions.push({
                    id: comp.composerId || crypto.randomUUID(),
                    title,
                    startedAt,
                    lastActiveAt,
                    status: 'active',
                    tokenCount,
                    messages
                  });
                }
              }
            }
          } catch (e) {
            // JSON parse error for this specific row, skip
          }
        }
      }
    } catch (e) {
      console.error('Failed to read Cursor sqlite DB via CLI:', e);
    }

    // No free needed for js-tiktoken

    // Sort by last active desc
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
      budgetUsedPercent: percent
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

import { ProviderAdapter, RuleFile, Session, ContextMetrics, HandoverPacket, Message } from './types';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
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

export class ClaudeCodeAdapter implements ProviderAdapter {
  id = 'claude-code';
  name = 'Claude Code';

  private getProjectsDir(): string {
    return path.join(os.homedir(), '.claude', 'projects');
  }

  async detect(workspacePath: string): Promise<boolean> {
    const hasClaudeMd = fs.existsSync(path.join(workspacePath, 'CLAUDE.md'));
    const hasClaudeDir = fs.existsSync(path.join(workspacePath, '.claude'));
    const hasGlobalDir = fs.existsSync(this.getProjectsDir());
    return hasClaudeMd || hasClaudeDir || hasGlobalDir;
  }

  async getRules(workspacePath: string): Promise<RuleFile[]> {
    const rules: RuleFile[] = [];
    const claudeMdPath = path.join(workspacePath, 'CLAUDE.md');
    
    if (fs.existsSync(claudeMdPath)) {
      try {
        const content = fs.readFileSync(claudeMdPath, 'utf8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const stats = fs.statSync(claudeMdPath);
        rules.push({
          id: `${this.id}-claude-md`,
          filename: 'CLAUDE.md',
          content,
          lastUpdatedAt: stats.mtime.toISOString(),
          hash
        });
      } catch (e) {
        console.error('Error reading CLAUDE.md:', e);
      }
    }

    // Support for .claude/settings.json or rules
    const rulesDir = path.join(workspacePath, '.claude', 'rules');
    if (fs.existsSync(rulesDir)) {
      try {
        const files = fs.readdirSync(rulesDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const filePath = path.join(rulesDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            const stats = fs.statSync(filePath);
            rules.push({
              id: `${this.id}-${file}`,
              filename: `.claude/rules/${file}`,
              content,
              lastUpdatedAt: stats.mtime.toISOString(),
              hash
            });
          }
        }
      } catch (e) {
        console.error('Error reading .claude/rules:', e);
      }
    }

    return rules;
  }

  async writeRules(workspacePath: string, rules: RuleFile[]): Promise<void> {
    for (const rule of rules) {
      try {
        if (rule.filename === 'CLAUDE.md') {
          const dest = path.join(workspacePath, 'CLAUDE.md');
          fs.writeFileSync(dest, rule.content, 'utf8');
        } else if (rule.filename.startsWith('.claude/rules/')) {
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

  async getSessions(workspacePath: string): Promise<Session[]> {
    const projectsDir = this.getProjectsDir();
    if (!fs.existsSync(projectsDir)) return [];

    const sessions: Session[] = [];
    let enc;
    try {
      enc = getEncoding('cl100k_base');
    } catch (e) {
      console.error('Tiktoken load error, falling back to approximation:', e);
    }

    try {
      const projects = fs.readdirSync(projectsDir);
      
      for (const projectHash of projects) {
        const projectPath = path.join(projectsDir, projectHash);
        if (!fs.statSync(projectPath).isDirectory()) continue;

        let projectName = '';
        const metadataPath = path.join(projectPath, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            if (meta.path) {
              projectName = path.basename(meta.path);
            }
          } catch (e) {
            // Ignore metadata read errors
          }
        }

        if (!projectName) {
          // Fallback to projectHash which is the folder name, e.g. "-Users-username-Work-project"
          const parts = projectHash.split('-');
          projectName = parts[parts.length - 1] || projectHash;
        }

        let sessionsDir = path.join(projectPath, 'sessions');
        if (!fs.existsSync(sessionsDir)) {
          sessionsDir = projectPath;
        }

        const sessionFiles = fs.readdirSync(sessionsDir);
        for (const file of sessionFiles) {
          if (!file.endsWith('.jsonl')) continue;

          const sessionFilePath = path.join(sessionsDir, file);
          try {
            const content = fs.readFileSync(sessionFilePath, 'utf8');
            const lines = content.split('\n').filter(l => l.trim() !== '');
            const messages: Message[] = [];
            let startedAt = new Date().toISOString();
            let lastActiveAt = startedAt;
            let title = projectName ? `[${projectName}] Claude Code Session` : 'Claude Code Session';
            let tokenCount = 0;
            let sessionWorkspacePath = '';

            for (const line of lines) {
              const obj = JSON.parse(line);
              
              if (obj.cwd && typeof obj.cwd === 'string') {
                sessionWorkspacePath = obj.cwd;
              }

              if (obj.isMeta) continue;

              const role = obj.type === 'user' || obj.type === 'assistant' 
                ? obj.type 
                : (obj.role || (obj.message && obj.message.role));
              
              let text = '';
              const rawContent = obj.content || obj.text || (obj.message && obj.message.content);
              if (typeof rawContent === 'string') {
                text = rawContent;
              } else if (Array.isArray(rawContent)) {
                const textParts: string[] = [];
                for (const part of rawContent) {
                  if (part && typeof part === 'object') {
                    if (part.type === 'text' && typeof part.text === 'string') {
                      textParts.push(part.text);
                    }
                  }
                }
                text = textParts.join('');
              }

              if (text) {
                // Filter out local terminal commands stdout/stderr and meta lines to keep chat tidy
                const trimmed = text.trim();
                if (trimmed.startsWith('<local-command-stdout>') || 
                    trimmed.startsWith('<local-command-stderr>') || 
                    trimmed.startsWith('<command-name>') ||
                    trimmed.startsWith('<command-message>') ||
                    trimmed.startsWith('<command-args>') ||
                    trimmed.startsWith('<command-status>') ||
                    trimmed.startsWith('<local-command-caveat>')) {
                  continue;
                }

                const time = obj.timestamp || obj.time || new Date().toISOString();
                lastActiveAt = time;
                if (messages.length === 0) startedAt = time;

                const tokens = enc ? enc.encode(text).length : Math.ceil(text.split(/\s+/).length * 1.3);
                tokenCount += tokens;

                if (messages.length === 0 && role === 'user') {
                  const baseTitle = text.split('\n')[0].substring(0, 50) + (text.length > 50 ? '...' : '');
                  title = projectName ? `[${projectName}] ${baseTitle}` : baseTitle;
                }

                messages.push({
                  role: role === 'user' ? 'user' : 'assistant',
                  content: text,
                  timestamp: time,
                  tokens
                });
              }
            }

            if (sessionWorkspacePath) {
              const root = findWorkspaceRoot(sessionWorkspacePath);
              if (root) {
                sessionWorkspacePath = root;
              }
            }

            if (messages.length > 0) {
              sessions.push({
                id: path.basename(file, '.jsonl'),
                title,
                startedAt,
                lastActiveAt,
                status: 'active',
                tokenCount,
                messages,
                workspacePath: sessionWorkspacePath || undefined
              });
            }
          } catch (err) {
            console.error(`Error parsing session file ${sessionFilePath}:`, err);
          }
        }
      }
    } catch (e) {
      console.error('Error reading Claude Code projects:', e);
    }

    return sessions.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  async getContextSize(workspacePath: string): Promise<ContextMetrics> {
    const sessions = await this.getSessions(workspacePath);
    const totalTokens = sessions.length > 0 ? sessions[0].tokenCount : 0;
    
    // Claude 3.5 Sonnet context window is 200,000 tokens
    const limit = 200000;
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

    const rawMarkdown = `# Claude Code Session Handover
**Session Title:** ${session.title}
**Provider Source:** Claude Code
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

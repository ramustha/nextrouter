import { ProviderAdapter, RuleFile, Session, ContextMetrics, HandoverPacket, Message } from './types';
import { calculateRateLimits, findWorkspaceRoot, extractMeaningfulTitle } from './utils';
import { getDatabase } from '../store/database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { getEncoding } from 'js-tiktoken';

export class AntigravityAdapter implements ProviderAdapter {
  id = 'antigravity';
  name = 'Antigravity';

  private getBrainDir(): string {
    return path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
  }

  async detect(workspacePath: string): Promise<boolean> {
    const hasGeminiMd = fs.existsSync(path.join(workspacePath, 'GEMINI.md'));
    const hasBrainDir = fs.existsSync(this.getBrainDir());
    return hasGeminiMd || hasBrainDir;
  }

  async getRules(workspacePath: string): Promise<RuleFile[]> {
    const geminiMdPath = path.join(workspacePath, 'GEMINI.md');
    if (!fs.existsSync(geminiMdPath)) return [];
    
    try {
      const content = fs.readFileSync(geminiMdPath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const stats = fs.statSync(geminiMdPath);

      return [{
        id: `${this.id}-gemini-md`,
        filename: 'GEMINI.md',
        content,
        lastUpdatedAt: stats.mtime.toISOString(),
        hash
      }];
    } catch (e) {
      console.error('Error reading GEMINI.md:', e);
      return [];
    }
  }

  async writeRules(workspacePath: string, rules: RuleFile[]): Promise<void> {
    const rule = rules.find(r => r.filename === 'GEMINI.md');
    if (!rule) return;
    try {
      const geminiMdPath = path.join(workspacePath, 'GEMINI.md');
      fs.writeFileSync(geminiMdPath, rule.content, 'utf8');
    } catch (e) {
      console.error('Error writing GEMINI.md:', e);
    }
  }

  async getSessions(workspacePath: string): Promise<Session[]> {
    const brainDir = this.getBrainDir();
    if (!fs.existsSync(brainDir)) return [];

    const sessions: Session[] = [];
    
    // Retrieve persistent sessions cache from globalThis
    const globalAntigravityCache = (globalThis as any)._antigravitySessionsCache || new Map<string, Session>();
    (globalThis as any)._antigravitySessionsCache = globalAntigravityCache;

    // Pre-populate memory cache from local DB on cold start
    if (globalAntigravityCache.size === 0) {
      try {
        const db = getDatabase();
        const dbSessions = db.sessions.all().filter(s => s.provider_id === 'antigravity');
        for (const s of dbSessions) {
          const mtimeMs = new Date(s.last_active_at).getTime();
          const cacheKey = `${s.id}-${mtimeMs}`;
          globalAntigravityCache.set(cacheKey, {
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
    try {
      const folders = fs.readdirSync(brainDir);
      let enc;
      try {
        enc = getEncoding('cl100k_base');
      } catch (e) {
        console.error('Tiktoken load error, falling back to approximation:', e);
      }

      for (const folder of folders) {
        if (folder === '.DS_Store' || folder === 'tempmediaStorage') continue;
        const sessionPath = path.join(brainDir, folder);
        if (!fs.statSync(sessionPath).isDirectory()) continue;

        const logPath = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
        if (!fs.existsSync(logPath)) continue;

        try {
          const stats = fs.statSync(logPath);
          const mtimeMs = stats.mtime.getTime();

          // Query persistent cache on globalThis
          const globalAntigravityCache = (globalThis as any)._antigravitySessionsCache || new Map<string, Session>();
          (globalThis as any)._antigravitySessionsCache = globalAntigravityCache;

          const cacheKey = `${folder}-${mtimeMs}`;
          const cachedSession = globalAntigravityCache.get(cacheKey);
          if (cachedSession) {
            sessions.push(cachedSession);
            continue;
          }

          const content = fs.readFileSync(logPath, 'utf8');
          const lines = content.split('\n').filter(l => l.trim() !== '');
          const messages: Message[] = [];
          let startedAt = new Date().toISOString();
          let lastActiveAt = startedAt;
          let title = 'Antigravity Session';
          let tokenCount = 0;
          let sessionWorkspacePath = '';

          for (const line of lines) {
            const step = JSON.parse(line);
            
            if (step.cwd && typeof step.cwd === 'string') {
              sessionWorkspacePath = step.cwd;
            } else if (step.workspaceUris && Array.isArray(step.workspaceUris) && step.workspaceUris.length > 0) {
              const uri = step.workspaceUris[0];
              if (uri.startsWith('file://')) {
                sessionWorkspacePath = decodeURIComponent(uri.replace(/^file:\/\//, ''));
              }
            } else if (step.content && typeof step.content === 'string') {
              const wsMatch = step.content.match(/"workspaceUris"\s*:\s*\[\s*"file:\/\/([^"]+)"/);
              if (wsMatch) {
                sessionWorkspacePath = decodeURIComponent(wsMatch[1]);
              } else {
                const homedir = os.homedir();
                const escapedHomedir = homedir.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp('file://(' + escapedHomedir + '[^\\s\\n)"\'`]+)');
                const fileMatch = step.content.match(regex);
                if (fileMatch) {
                  sessionWorkspacePath = decodeURIComponent(fileMatch[1]);
                }
              }
            } else if (step.tool_calls && Array.isArray(step.tool_calls)) {
              for (const call of step.tool_calls) {
                if (call.args) {
                  try {
                    const args = typeof call.args === 'string' ? JSON.parse(call.args) : call.args;
                    const pathVal = args.DirectoryPath || args.AbsolutePath || args.Cwd || args.cwd || '';
                    if (pathVal && typeof pathVal === 'string') {
                      const cleanPath = pathVal.replace(/^"|"$/g, '');
                      if (cleanPath.startsWith('/')) {
                        sessionWorkspacePath = cleanPath;
                      }
                    }
                  } catch (e) {
                    // Ignore JSON parse errors in args
                  }
                }
              }
            }

            if (step.created_at) {
              lastActiveAt = step.created_at;
              if (messages.length === 0) startedAt = step.created_at;
            }

            if (step.type === 'USER_INPUT' && step.content) {
              const cleanedText = step.content.replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '').trim();
              if (messages.length === 0) {
                const extracted = extractMeaningfulTitle(cleanedText);
                if (extracted) {
                  title = extracted;
                }
              }
              const tokens = enc ? enc.encode(cleanedText).length : Math.ceil(cleanedText.split(/\s+/).length * 1.3);
              tokenCount += tokens;
              messages.push({
                role: 'user',
                content: cleanedText,
                timestamp: step.created_at,
                tokens
              });
            } else if (step.type === 'PLANNER_RESPONSE' && step.content) {
              const tokens = enc ? enc.encode(step.content).length : Math.ceil(step.content.split(/\s+/).length * 1.3);
              tokenCount += tokens;
              messages.push({
                role: 'assistant',
                content: step.content,
                timestamp: step.created_at,
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

          if (!sessionWorkspacePath) {
            const mdFiles = ['implementation_plan.md', 'task.md', 'walkthrough.md'];
            for (const file of mdFiles) {
              const filePath = path.join(sessionPath, file);
              if (fs.existsSync(filePath)) {
                try {
                  const content = fs.readFileSync(filePath, 'utf8');
                  const homedir = os.homedir();
                  const escapedHomedir = homedir.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                  const regex = new RegExp('file://(' + escapedHomedir + '[^\\s\\n)]+)');
                  const match = content.match(regex);
                  if (match) {
                    const cleanPath = decodeURIComponent(match[1]);
                    const root = findWorkspaceRoot(cleanPath);
                    if (root) {
                      sessionWorkspacePath = root;
                      break;
                    }
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
            }
          }

          if (messages.length > 0) {
            const sessionObj: Session = {
              id: folder,
              title,
              startedAt,
              lastActiveAt,
              status: 'active',
              tokenCount,
              messages,
              workspacePath: sessionWorkspacePath || undefined
            };
            const globalAntigravityCache = (globalThis as any)._antigravitySessionsCache;
            if (globalAntigravityCache) {
              const cacheKey = `${folder}-${stats.mtime.getTime()}`;
              globalAntigravityCache.set(cacheKey, sessionObj);
            }
            sessions.push(sessionObj);
          }
        } catch (err) {
          console.error(`Error parsing session logs at ${logPath}:`, err);
        }
      }

      // No free needed for js-tiktoken
    } catch (e) {
      console.error('Error reading Antigravity sessions:', e);
    }

    // Sort by last active desc
    return sessions.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  async getContextSize(workspacePath: string): Promise<ContextMetrics> {
    const sessions = await this.getSessions(workspacePath);
    const resolvedPath = path.resolve(workspacePath);
    const workspaceSessions = sessions.filter(s => 
      s.workspacePath && path.resolve(s.workspacePath) === resolvedPath
    );
    const totalTokens = workspaceSessions.length > 0 ? workspaceSessions[0].tokenCount : 0;
    
    // Antigravity models typically have large context windows (e.g. 2M tokens for Gemini 1.5 Pro)
    // We'll set a standard default window size limit of 1,000,000 tokens for visual safety
    const limit = 1000000;
    const percent = Math.min(100, Math.round((totalTokens / limit) * 100));

    const rateLimits = calculateRateLimits(sessions, 100, 1500);

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

    // Compile summary of context
    const recentMessages = session.messages.slice(-5);
    const messageHistoryText = recentMessages
      .map(m => `### ${m.role === 'user' ? 'User' : 'Assistant'}\n${m.content}`)
      .join('\n\n');

    const rawMarkdown = `# Antigravity Session Handover
**Session Title:** ${session.title}
**Provider Source:** Antigravity
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

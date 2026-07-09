import { ProviderAdapter, RuleFile, Session, ContextMetrics, HandoverPacket, Message } from './types';
import { calculateRateLimits, findWorkspaceRoot, extractMeaningfulTitle } from './utils';
import { getDatabase } from '../store/database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { getEncoding } from 'js-tiktoken';

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
    
    // Retrieve persistent sessions cache from globalThis
    const globalClaudeCache = (globalThis as any)._claudeSessionsCache || new Map<string, Session>();
    (globalThis as any)._claudeSessionsCache = globalClaudeCache;

    // Pre-populate memory cache from local DB on cold start
    if (globalClaudeCache.size === 0) {
      try {
        const db = getDatabase();
        const dbSessions = db.sessions.all().filter(s => s.provider_id === 'claude-code');
        for (const s of dbSessions) {
          const mtimeMs = new Date(s.last_active_at).getTime();
          const cacheKey = `sa-v3-${s.id}.jsonl-${mtimeMs}`;
          globalClaudeCache.set(cacheKey, {
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
        let projectWorkspacePath = '';
        const metadataPath = path.join(projectPath, 'metadata.json');
        
        // Cache parsed project metadata
        const globalProjectsCache = (globalThis as any)._claudeProjectsCache || new Map<string, { name: string; path: string }>();
        (globalThis as any)._claudeProjectsCache = globalProjectsCache;
        
        const cachedProj = globalProjectsCache.get(projectHash);
        if (cachedProj) {
          projectName = cachedProj.name;
          projectWorkspacePath = cachedProj.path;
        } else if (fs.existsSync(metadataPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            if (meta.path) {
              projectName = path.basename(meta.path);
              projectWorkspacePath = meta.path;
              globalProjectsCache.set(projectHash, { name: projectName, path: meta.path });
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
            const stats = fs.statSync(sessionFilePath);
            let maxMtimeMs = stats.mtime.getTime();

            const sessionId = path.basename(file, '.jsonl');
            const subagentsDir = path.join(sessionsDir, sessionId, 'subagents');
            if (fs.existsSync(subagentsDir)) {
              try {
                const subagentStats = fs.statSync(subagentsDir);
                if (subagentStats.mtime.getTime() > maxMtimeMs) {
                  maxMtimeMs = subagentStats.mtime.getTime();
                }
                const subagentFiles = fs.readdirSync(subagentsDir);
                for (const saFile of subagentFiles) {
                  if (saFile.endsWith('.jsonl')) {
                    const saStats = fs.statSync(path.join(subagentsDir, saFile));
                    if (saStats.mtime.getTime() > maxMtimeMs) {
                      maxMtimeMs = saStats.mtime.getTime();
                    }
                  }
                }
              } catch (e) {
                // Ignore stats errors
              }
            }

            // Query persistent cache on globalThis
            const globalClaudeCache = (globalThis as any)._claudeSessionsCache || new Map<string, Session>();
            (globalThis as any)._claudeSessionsCache = globalClaudeCache;

            const cacheKey = `sa-v3-${file}-${maxMtimeMs}`;
            const cachedSession = globalClaudeCache.get(cacheKey);
            if (cachedSession) {
              sessions.push(cachedSession);
              continue;
            }

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
                  const baseTitle = extractMeaningfulTitle(text);
                  if (baseTitle) {
                    title = projectName ? `[${projectName}] ${baseTitle}` : baseTitle;
                  }
                }

                messages.push({
                  role: role === 'user' ? 'user' : 'assistant',
                  content: text,
                  timestamp: time,
                  tokens
                });
              }
            }

            // Extract and parse subagent conversation logs if they exist
            const subagentMessages: Message[] = [];
            if (fs.existsSync(subagentsDir)) {
              try {
                const subagentFiles = fs.readdirSync(subagentsDir);
                for (const saFile of subagentFiles) {
                  if (!saFile.endsWith('.jsonl')) continue;
                  const saFilePath = path.join(subagentsDir, saFile);
                  const saMetaPath = path.join(subagentsDir, saFile.replace('.jsonl', '.meta.json'));
                  
                  let description = '';
                  const saAgentId = saFile.replace('agent-', '').replace('.jsonl', '');
                  if (fs.existsSync(saMetaPath)) {
                    try {
                      const meta = JSON.parse(fs.readFileSync(saMetaPath, 'utf8'));
                      description = meta.description || '';
                    } catch (e) {
                      // ignore
                    }
                  }

                  try {
                    const saContent = fs.readFileSync(saFilePath, 'utf8');
                    const saLines = saContent.split('\n').filter(l => l.trim() !== '');
                    for (const saLine of saLines) {
                      const saObj = JSON.parse(saLine);
                      if (saObj.isMeta) continue;

                      const saRole = saObj.type === 'user' || saObj.type === 'assistant' 
                        ? saObj.type 
                        : (saObj.role || (saObj.message && saObj.message.role));

                      let saText = '';
                      const saRawContent = saObj.content || saObj.text || (saObj.message && saObj.message.content);
                      if (typeof saRawContent === 'string') {
                        saText = saRawContent;
                      } else if (Array.isArray(saRawContent)) {
                        const textParts: string[] = [];
                        for (const part of saRawContent) {
                          if (part && typeof part === 'object') {
                            if (part.type === 'text' && typeof part.text === 'string') {
                              textParts.push(part.text);
                            }
                          }
                        }
                        saText = textParts.join('');
                      }

                      if (saText) {
                        const trimmed = saText.trim();
                        if (trimmed.startsWith('<local-command-stdout>') || 
                            trimmed.startsWith('<local-command-stderr>') || 
                            trimmed.startsWith('<command-name>') ||
                            trimmed.startsWith('<command-message>') ||
                            trimmed.startsWith('<command-args>') ||
                            trimmed.startsWith('<command-status>') ||
                            trimmed.startsWith('<local-command-caveat>')) {
                          continue;
                        }

                        const saTime = saObj.timestamp || saObj.time || new Date().toISOString();
                        const saTokens = enc ? enc.encode(saText).length : Math.ceil(saText.split(/\s+/).length * 1.3);
                        tokenCount += saTokens;

                        const subagentLabel = description ? description : `Agent ${saAgentId}`;
                        const sender = saRole === 'user'
                          ? `Subagent Prompt (${subagentLabel})`
                          : `Subagent (${subagentLabel})`;

                        subagentMessages.push({
                          role: saRole === 'user' ? 'user' : 'assistant',
                          content: saText,
                          timestamp: saTime,
                          tokens: saTokens,
                          sender
                        });
                      }
                    }
                  } catch (saParseErr) {
                    console.error(`Error parsing subagent file ${saFilePath}:`, saParseErr);
                  }
                }
              } catch (saDirErr) {
                console.error(`Error reading subagents directory ${subagentsDir}:`, saDirErr);
              }
            }

            // Merge and sort messages chronologically
            if (subagentMessages.length > 0) {
              messages.push(...subagentMessages);
              messages.sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return timeA - timeB;
              });
            }

            if (messages.length > 0) {
              startedAt = messages[0].timestamp || startedAt;
              lastActiveAt = messages[messages.length - 1].timestamp || lastActiveAt;
            }

            if (!sessionWorkspacePath && projectWorkspacePath) {
              sessionWorkspacePath = projectWorkspacePath;
            }

            if (sessionWorkspacePath) {
              const root = findWorkspaceRoot(sessionWorkspacePath);
              if (root) {
                sessionWorkspacePath = root;
              }
            }

            if (messages.length > 0) {
              const sessionObj: Session = {
                id: sessionId,
                title,
                startedAt,
                lastActiveAt,
                status: 'active',
                tokenCount,
                messages,
                workspacePath: sessionWorkspacePath || undefined
              };
              const globalClaudeCache = (globalThis as any)._claudeSessionsCache;
              if (globalClaudeCache) {
                const cacheKey = `sa-v3-${file}-${maxMtimeMs}`;
                globalClaudeCache.set(cacheKey, sessionObj);
              }
              sessions.push(sessionObj);
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
    const resolvedPath = path.resolve(workspacePath);
    const workspaceSessions = sessions.filter(s => 
      s.workspacePath && path.resolve(s.workspacePath) === resolvedPath
    );
    const totalTokens = workspaceSessions.length > 0 ? workspaceSessions[0].tokenCount : 0;
    
    // Claude 3.5 Sonnet context window is 200,000 tokens
    const limit = 200000;
    const percent = Math.min(100, Math.round((totalTokens / limit) * 100));

    const rateLimits = calculateRateLimits(sessions, 50, 500);

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
      .map(m => `### ${m.sender || (m.role === 'user' ? 'User' : 'Assistant')}\n${m.content}`)
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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Session, HandoverPacket } from '../adapters/types';
import { countTokens } from './tokenizer';
import { getDatabase } from '../store/database';
import { execSync } from 'child_process';
import { findPlanFiles, findSessionPlanFiles } from '../adapters/utils';

interface CachedHandover {
  packet: HandoverPacket;
  lastActiveAt: string;
  cachedAt: number;
}

function getGitContext(cwd?: string): { branch: string; status: string; diff: string; originalDiffLength: number; isDiffTruncated: boolean } {
  try {
    const options = {
      encoding: 'utf8' as const,
      stdio: ['pipe', 'pipe', 'ignore'] as any,
      timeout: 1500, // Prevent hanging if git commands take too long
      ...(cwd ? { cwd } : {})
    };
    const branch = execSync('git branch --show-current', options).trim();
    const status = execSync('git status -s', options).trim();
    const originalDiff = execSync('git diff', options).trim();
    
    let diff = originalDiff;
    const isDiffTruncated = originalDiff.length > 2500;
    if (isDiffTruncated) {
      diff = originalDiff.substring(0, 2500) + '\n\n... [git diff truncated by NextRouter to save tokens] ...';
    }

    return { branch, status, diff, originalDiffLength: originalDiff.length, isDiffTruncated };
  } catch (e) {
    // Return empty if git is not initialized or fails
    return { branch: '', status: '', diff: '', originalDiffLength: 0, isDiffTruncated: false };
  }
}

function parseWorkspacePlan(workspacePath?: string, session?: Session): { completed: string[]; remaining: string[] } {
  const completed: string[] = [];
  const remaining: string[] = [];
  
  if (!workspacePath) return { completed, remaining };
  
  const plans = session ? findSessionPlanFiles(session, workspacePath) : findPlanFiles(workspacePath);
  
  for (const plan of plans) {
    try {
      const content = fs.readFileSync(plan.path, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- [x]') || trimmed.startsWith('- `[x]`')) {
          const taskText = trimmed.replace(/^-\s*`?\[x\]`?\s*/, '').trim();
          if (taskText && completed.length < 15) completed.push(taskText);
        } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- `[ ]`') || trimmed.startsWith('- [/]') || trimmed.startsWith('- `[/]`')) {
          const taskText = trimmed.replace(/^-\s*`?\[[ \/]\]`?\s*/, '').trim();
          if (taskText && remaining.length < 15) remaining.push(taskText);
        }
      }
      if (completed.length > 0 || remaining.length > 0) {
        break;
      }
    } catch (e) {
      // Ignore read errors
    }
  }
  return { completed, remaining };
}

function getActiveSkills(workspacePath?: string): string[] {
  const activeSkills: string[] = [];
  if (!workspacePath) return activeSkills;
  
  const skillsDir = path.join(workspacePath, 'skills');
  if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
    try {
      const files = fs.readdirSync(skillsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace(/\.md$/, '').replace(/[-_]/g, ' ');
          activeSkills.push(name.charAt(0).toUpperCase() + name.slice(1));
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  return activeSkills;
}

function inferToolsUsed(session: Session): string[] {
  const tools = new Set<string>();
  
  const toolPatterns = [
    { name: 'Git (VCS)', regex: /\b(git status|git diff|git commit|git checkout|git branch)\b/i },
    { name: 'Node / NPM', regex: /\b(npm run|npm install|yarn|pnpm|npx)\b/i },
    { name: 'TypeScript Compiler (tsc)', regex: /\b(tsc|tsconfig)\b/i },
    { name: 'Next.js Dev Server', regex: /\b(next dev|npm run dev)\b/i },
    { name: 'Model Context Protocol (MCP)', regex: /\b(mcp|get_shared_context|get_handover|sync_rules|prune_code)\b/i },
    { name: 'Code Pruner', regex: /\b(prune|pruning|syntax compressor)\b/i },
    { name: 'Database / SQLite', regex: /\b(sqlite|sqlite3|store\.db|database\.ts)\b/i },
    { name: 'Terminal Execution', regex: /\b(terminal|execSync|runCommand|run_command|commandLine)\b/i },
    { name: 'Filesystem Reads/Writes', regex: /\b(fs\.|readFile|writeFile|view_file|replace_file_content|write_to_file)\b/i }
  ];
  
  for (const msg of session.messages) {
    for (const pattern of toolPatterns) {
      if (pattern.regex.test(msg.content)) {
        tools.add(pattern.name);
      }
    }
  }
  
  return Array.from(tools);
}

export function generateHandover(
  sourceProviderId: string,
  session: Session,
  targetProviderId?: string,
  handoverType: 'briefing' | 'original' = 'briefing'
): HandoverPacket {
  const cacheKey = `${session.id}_${handoverType}`;
  const globalCache = ((globalThis as any)._handoverPacketsCache) || new Map<string, CachedHandover>();
  (globalThis as any)._handoverPacketsCache = globalCache;

  const cached = globalCache.get(cacheKey);
  if (cached && cached.lastActiveAt === session.lastActiveAt) {
    const lastActiveDate = new Date(session.lastActiveAt);
    const now = new Date();
    const isSessionActiveToday = lastActiveDate.getFullYear() === now.getFullYear() &&
                                 lastActiveDate.getMonth() === now.getMonth() &&
                                 lastActiveDate.getDate() === now.getDate();
    
    const cacheAgeMs = Date.now() - cached.cachedAt;
    if (!isSessionActiveToday || cacheAgeMs < 30000) {
      return cached.packet;
    }
  }

  const db = getDatabase();
  
  // Expose recent 6 messages in conversational context
  const recentMessages = session.messages.slice(-6);
  const convoText = recentMessages
    .map(m => `### ${m.sender || (m.role === 'user' ? 'User' : 'Assistant')} (${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ''})\n${m.content}`)
    .join('\n\n');

  // Detect files mentioned in context
  const files: Array<{ path: string; description?: string; tokens?: number }> = [];
  const uniquePaths = new Set<string>();

  // Robust path extractor regex matching standard programming and markdown enclosures:
  // e.g. backticks `path.ts`, quotes "path.ts", markdown links [label](path.ts), raw paths.
  const robustFileRegex = /(?:[`'"(\[\s]|^)([\w\-.\/]+\.(?:tsx?|jsx?|md|json|css|py|go|rs|c|cpp|h|html|sh|yml|yaml|sql|ps1))(?:[`'")\]\s:;,.!?]|$)/g;

  // Extract file names from conversation
  for (const m of session.messages) {
    let match;
    robustFileRegex.lastIndex = 0;
    while ((match = robustFileRegex.exec(m.content)) !== null) {
      const filePath = match[1];
      if (filePath && filePath.includes('.') && !filePath.startsWith('.') && filePath.length > 3) {
        // Skip common web urls or email addresses
        if (filePath.includes('@') || filePath.startsWith('http') || filePath.startsWith('www')) continue;
        uniquePaths.add(filePath);
      }
    }
  }

  // Retrieve Git details
  const git = getGitContext(session.workspacePath);
  if (git.status) {
    const statusLines = git.status.split('\n');
    for (const line of statusLines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const filePath = parts[1];
        uniquePaths.add(filePath);
      }
    }
  }

  const workspaceRoot = session.workspacePath || '';

  for (const p of uniquePaths) {
    const isModified = git.status.includes(p);
    files.push({
      path: p,
      description: isModified ? `Modified file (Git uncommitted) inside ${workspaceRoot}` : `Referenced file in ${session.title} inside ${workspaceRoot}`,
      tokens: 0
    });
  }

  // Fetch plan and tasks
  const { completed: completedTasks, remaining: remainingTasks } = parseWorkspacePlan(session.workspacePath, session);
  const activeSkills = getActiveSkills(session.workspacePath);
  const inferredTools = inferToolsUsed(session);

  let rawMarkdown = '';
  if (handoverType === 'original') {
    rawMarkdown = `# NextRouter Handover — Original Context\n` +
      `**Session ID:** \`${session.id}\`\n` +
      `**From Provider:** \`${sourceProviderId}\`\n` +
      `**To Provider:** \`${targetProviderId || 'Any'}\`\n` +
      `**Workspace Absolute Root:** \`${workspaceRoot || 'Not specified'}\`\n` +
      `**Generated At:** ${new Date().toLocaleString()}\n` +
      `**Source Session Title:** *${session.title}*\n\n` +
      `---\n\n` +
      `## 💬 Original Conversation Logs (${session.messages.length} messages)\n\n` +
      session.messages.map(m => {
        const roleLabel = m.sender || (m.role === 'user' ? '👤 User' : m.role === 'system' ? '⚙️ System' : '🤖 Assistant');
        const time = m.timestamp ? ` [${new Date(m.timestamp).toLocaleTimeString()}]` : '';
        const tokens = m.tokens ? ` (${m.tokens} tokens)` : '';
        return `### ${roleLabel}${time}${tokens}\n${m.content}`;
      }).join('\n\n---\n\n');
  } else {
    // Find first user message for initial goal/intent context
    const firstUserMsg = session.messages.find(m => m.role === 'user');
    const requestText = firstUserMsg
      ? `\n**Original Request / Goal:**\n> ${firstUserMsg.content.split('\n').join('\n> ')}\n`
      : '';

    rawMarkdown = `# NextRouter Handover Briefing
**Session ID:** \`${session.id}\`
**From Provider:** \`${sourceProviderId}\`
**To Provider:** \`${targetProviderId || 'Any'}\`
**Generated At:** ${new Date().toLocaleString()}
**Source Session Title:** *${session.title}*
${git.branch ? `**Active Git Branch:** \`${git.branch}\`\n` : ''}**Workspace Absolute Root:** \`${workspaceRoot || 'Not specified'}\` *(All relative file paths below are relative to this directory)*

---

## 🛡️ Context Integrity Audit
- **Audit Status:** ${git.isDiffTruncated || session.messages.length > 6 ? '⚠️ Partial (Some context truncated for window limits)' : '✅ Fully Lossless (100% context preserved)'}
- **Conversation Logs:** ${session.messages.length > 6 ? `Recent 6 messages included (out of ${session.messages.length} total; oldest turns omitted)` : `All ${session.messages.length} messages included (100% logs coverage)`}
- **Git Diffs Sync:** ${git.diff ? (git.isDiffTruncated ? `⚠️ Truncated (capped at 2500 chars to save tokens; original diff size was ${git.originalDiffLength} chars)` : `✅ Lossless (full diff included: ${git.diff.length} chars)`) : 'N/A (No uncommitted diffs)'}
- **Workspace Roadmaps:** ${completedTasks.length > 0 || remainingTasks.length > 0 ? `✅ Synced (loaded active plan with ${completedTasks.length + remainingTasks.length} checklist items)` : 'N/A (No active plans/tasks detected)'}

---

## 🎯 Active Goal & Context Summary
The active task was started in \`${sourceProviderId}\`. Here is the high-level description:
> *${session.title}*
${requestText}
Total session tokens consumed: **${session.tokenCount} tokens**.

---

## 📋 Summarized Planning & Execution Status

### ✅ Executed & Completed Milestones
${completedTasks.length > 0 ? completedTasks.map(t => `- **Done:** ${t}`).join('\n') : '*No completed tasks registered in workspace plan.*'}

### ⏳ Remaining Work & Unexecuted Plan
${remainingTasks.length > 0 ? remainingTasks.map(t => `- [ ] ${t}`).join('\n') : '*No pending checklist items found in active plan.*'}

---

## 🛠️ Tools & Skills Utilized in Context

### 🧠 Active Prompt Skills & Standards
${activeSkills.length > 0 ? activeSkills.map(s => `- **${s}**`).join('\n') : '*No custom prompt skills defined in `skills/`.*'}

### 🔧 Inferred Tools & Utilities
${inferredTools.length > 0 ? inferredTools.map(t => `- **${t}**`).join('\n') : '*No specific tools inferred from conversation logs.*'}

---

## 🕒 Recent Conversation Logs
Here are the recent conversation turns to reconstruct conversational state:

${convoText}

---

## 📂 Files in Scope
The following files are actively being edited or referenced:
${files.length > 0 ? files.map(f => `- [ ] \`${f.path}\` — ${f.description}`).join('\n') : '*No specific files detected in workspace.*'}

${git.diff ? `---

## 📝 Recent Git Diffs
Here are the uncommitted changes made in this session:
\`\`\`diff
${git.diff}
\`\`\`
` : ''}
---

## 🚀 How to Resume
1. Copy the markdown content above and paste it into the new AI chat session.
2. The AI will immediately parse your recent conversation history, file scopes, and uncommitted diffs to pick up exactly where you left off.
`;
  }

  const packet: HandoverPacket = {
    id: crypto.randomUUID(),
    sourceProviderId,
    sourceSessionId: session.id,
    targetProviderId,
    createdAt: new Date().toISOString(),
    summary: session.title,
    files,
    rawMarkdown
  };

  // Persist to DB
  db.handoverPackets.insert({
    id: packet.id,
    source_provider_id: packet.sourceProviderId,
    source_session_id: packet.sourceSessionId,
    target_provider_id: packet.targetProviderId,
    created_at: packet.createdAt,
    summary: packet.summary,
    files: JSON.stringify(packet.files),
    raw_markdown: packet.rawMarkdown
  });

  // Store in cache
  globalCache.set(cacheKey, {
    packet,
    lastActiveAt: session.lastActiveAt,
    cachedAt: Date.now()
  });

  return packet;
}

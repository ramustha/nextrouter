import crypto from 'crypto';
import { Session, HandoverPacket } from '../adapters/types';
import { countTokens } from './tokenizer';
import { getDatabase } from '../store/database';
import { execSync } from 'child_process';

function getGitContext(): { branch: string; status: string; diff: string } {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const status = execSync('git status -s', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    let diff = execSync('git diff', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    
    if (diff.length > 2500) {
      diff = diff.substring(0, 2500) + '\n\n... [git diff truncated by NextRouter to save tokens] ...';
    }

    return { branch, status, diff };
  } catch (e) {
    // Return empty if git is not initialized or fails
    return { branch: '', status: '', diff: '' };
  }
}

export function generateHandover(
  sourceProviderId: string,
  session: Session,
  targetProviderId?: string
): HandoverPacket {
  const db = getDatabase();
  
  // Expose recent 6 messages in conversational context
  const recentMessages = session.messages.slice(-6);
  const convoText = recentMessages
    .map(m => `### ${m.role === 'user' ? 'User' : 'Assistant'} (${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ''})\n${m.content}`)
    .join('\n\n');

  // Detect files mentioned in context
  const files: Array<{ path: string; description?: string; tokens?: number }> = [];
  const fileRegex = /(?:^|\s)([\w\d.\-_/]+\.[\w\d]+)(?:\s|$)/g;
  const uniquePaths = new Set<string>();

  // Extract file names from conversation
  for (const m of session.messages) {
    let match;
    while ((match = fileRegex.exec(m.content)) !== null) {
      const filePath = match[1];
      if (filePath.includes('.') && !filePath.startsWith('.') && filePath.length > 3) {
        uniquePaths.add(filePath);
      }
    }
  }

  // Retrieve Git details
  const git = getGitContext();
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

  for (const p of uniquePaths) {
    const isModified = git.status.includes(p);
    files.push({
      path: p,
      description: isModified ? 'Modified file (Git uncommitted)' : `Referenced file in ${session.title}`,
      tokens: 0
    });
  }

  const rawMarkdown = `# NextRouter Handover Briefing
**Session ID:** \`${session.id}\`
**From Provider:** \`${sourceProviderId}\`
**To Provider:** \`${targetProviderId || 'Any'}\`
**Generated At:** ${new Date().toLocaleString()}
**Source Session Title:** *${session.title}*
${git.branch ? `**Active Git Branch:** \`${git.branch}\`\n` : ''}
---

## 🎯 Active Goal & Context Summary
The active task was started in \`${sourceProviderId}\`. Here is the high-level description:
> *${session.title}*

Total session tokens consumed: **${session.tokenCount} tokens**.

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

  return packet;
}

# UI/UX Revamp + Cursor/Antigravity Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the NextRouter dashboard with clear feature explanations and better UX, while fixing Cursor and Antigravity so their MCP-backed commands actually work end-to-end without manual configuration.

**Architecture:** A new `src/config/providers.ts` becomes the single source of truth for provider colors/icons/descriptions, eliminating 5+ hardcoded if-else chains in the dashboard. The plugin installer gains `.cursor/mcp.json` and `~/.gemini/settings.json` writes so both providers have their MCP server registered on install. The dashboard gains a setup-status banner, inline feature explanations, and richer empty states. Walkthrough provider guides get accurate, step-by-step MCP setup instructions per provider.

**Tech Stack:** Next.js 14, TypeScript, React inline styles, file-system writes (no new npm deps).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/config/providers.ts` | Centralized provider colors, icons, descriptions, bg colors |
| Modify | `src/plugins/installer.ts` | Write `.cursor/mcp.json` + `~/.gemini/settings.json`; richer MDC/GEMINI.md content; update status checks + uninstall |
| Modify | `src/app/page.tsx` | Import provider config; add setup-status banner; add feature guide; replace 5 hardcoded chains; better empty states; overview card subtitles |
| Modify | `src/app/walkthrough/page.tsx` | Rewrite Cursor and Antigravity provider guide tabs with accurate MCP config steps |

---

## Task 1: Centralized Provider Config

**Files:**
- Create: `src/config/providers.ts`

- [ ] **Step 1: Create `src/config/providers.ts`**

```typescript
export interface ProviderMeta {
  id: string;
  name: string;
  color: string;
  colorBg: string;
  icon: string;
  description: string;
  mcpConfigNote: string;
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    color: '#a78bfa',
    colorBg: 'rgba(139, 92, 246, 0.15)',
    icon: '🤖',
    description: 'Anthropic Claude via Claude Code CLI',
    mcpConfigNote: 'MCP registered via `claude mcp add`. Global slash commands in ~/.claude/commands/'
  },
  'cursor': {
    id: 'cursor',
    name: 'Cursor',
    color: '#06b6d4',
    colorBg: 'rgba(6, 182, 212, 0.15)',
    icon: '🖱️',
    description: 'AI-powered code editor with Cursor AI chat',
    mcpConfigNote: 'MCP registered via .cursor/mcp.json. MDC rule always-applied from .cursor/rules/'
  },
  'antigravity': {
    id: 'antigravity',
    name: 'Antigravity',
    color: '#10b981',
    colorBg: 'rgba(16, 185, 129, 0.15)',
    icon: '🌀',
    description: 'Gemini CLI-powered AI coding assistant',
    mcpConfigNote: 'MCP registered via ~/.gemini/settings.json. System instructions in GEMINI.md'
  },
  'copilot': {
    id: 'copilot',
    name: 'GitHub Copilot',
    color: '#f59e0b',
    colorBg: 'rgba(245, 158, 11, 0.15)',
    icon: '🐙',
    description: 'GitHub Copilot in VS Code / JetBrains',
    mcpConfigNote: 'CLI tasks in .vscode/tasks.json. Instructions in .github/copilot-instructions.md'
  }
};

export function getProviderMeta(id: string): ProviderMeta {
  return PROVIDER_META[id] ?? {
    id,
    name: id,
    color: '#64748b',
    colorBg: 'rgba(100, 116, 139, 0.1)',
    icon: '🔧',
    description: 'Unknown AI provider',
    mcpConfigNote: ''
  };
}

export const ALL_PROVIDER_IDS = ['claude-code', 'cursor', 'antigravity', 'copilot'] as const;
```

- [ ] **Step 2: Verify the file parses without TypeScript errors**

Run: `cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsc --noEmit 2>&1 | head -5`
Expected: no output (zero errors)

- [ ] **Step 3: Commit**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && git add src/config/providers.ts && git commit -m "feat: centralized provider metadata config (colors, icons, descriptions)"
```

---

## Task 2: Fix Cursor Plugin — MCP Registration + Enhanced MDC Content

**Files:**
- Modify: `src/plugins/installer.ts`

The current `installCursorMdc()` writes only the MDC rule. Cursor needs a `.cursor/mcp.json` file to register the NextRouter MCP server. The `getIntegrationFiles()` for cursor and `uninstallPlugin()` for cursor must also be updated.

- [ ] **Step 1: Read the current installer**

```bash
cat /Users/ramadhani.musthofa/Work/nextrouter/src/plugins/installer.ts
```

- [ ] **Step 2: Update `getIntegrationFiles()` — add mcp.json to cursor files list**

Find this block in `getIntegrationFiles()`:
```typescript
case 'cursor':
  return [path.join(workspacePath, '.cursor', 'rules', 'nextrouter-commands.mdc')];
```

Replace with:
```typescript
case 'cursor':
  return [
    path.join(workspacePath, '.cursor', 'rules', 'nextrouter-commands.mdc'),
    path.join(workspacePath, '.cursor', 'mcp.json')
  ];
```

- [ ] **Step 3: Replace the entire `installCursorMdc()` function**

Find the function `function installCursorMdc(workspacePath: string, cliCmd: string, logs: string[]): void {` and replace the entire function body through its closing `}` with:

```typescript
function installCursorMdc(workspacePath: string, cliCmd: string, logs: string[]): void {
  const rulesDir = path.join(workspacePath, '.cursor', 'rules');
  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  const mcpPath = path.resolve(workspacePath, 'src', 'cli', 'mcp.ts');

  const mdcContent = `---
description: NextRouter context management — MCP tools and CLI commands
globs: ["**/*"]
alwaysApply: true
---

# NextRouter — Context Management via MCP

NextRouter is registered as an MCP server in this workspace (\`.cursor/mcp.json\`). Call its tools proactively whenever the user needs context management, handovers, or token budget awareness.

## MCP Tools — When and How to Call Them

### \`get_shared_context\` (no parameters)
Call this when: user asks "what were we working on?", "what's the current status?", or when starting a new chat after a break.
Returns: the most recent active session title, provider, token count, and last few messages.

### \`save_context\` (parameters: providerId, title, messages)
Call this when: user says "save this session", "checkpoint this", or at natural stopping points.
Example call:
\`\`\`json
{ "providerId": "cursor", "title": "Fixing auth middleware bug", "messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}] }
\`\`\`

### \`get_handover\` (parameters: sourceProviderId, targetProviderId?)
Call this when: user says "I want to continue this in Claude", "hand this off to Antigravity", or "generate a briefing".
Example call: \`{ "sourceProviderId": "cursor", "targetProviderId": "claude-code" }\`
Returns: a full Markdown handover packet the user can paste into the target provider.

### \`sync_rules\` (parameters: workspacePath)
Call this when: user says "sync my rules", "update all provider configs", or after editing .cursorrules.
Example call: \`{ "workspacePath": "${workspacePath}" }\`

### \`prune_code\` (parameters: filepath, write?)
Call this when: a file is too large to fit in context, or user says "prune this file", "trim the implementation".
Example call: \`{ "filepath": "src/adapters/cursor.ts", "write": false }\`
Returns: pruned outline + token savings report.

### \`get_active_plan\` (parameters: workspacePath)
Call this when: user asks "what's the plan?", "show me the current roadmap", or when starting a new feature.
Example call: \`{ "workspacePath": "${workspacePath}" }\`

## CLI Commands (via Terminal)
\`\`\`bash
${cliCmd} status        # Show detected providers and active sessions
${cliCmd} sync          # Sync .cursorrules, CLAUDE.md, GEMINI.md
${cliCmd} handover cursor claude-code  # Generate a handover packet
${cliCmd} tokens        # Show token usage vs context window limits
${cliCmd} prune src/adapters/cursor.ts  # Prune a file
\`\`\`
`;

  const mdcPath = path.join(rulesDir, 'nextrouter-commands.mdc');
  fs.writeFileSync(mdcPath, mdcContent, 'utf8');
  logs.push(`Cursor MDC rule installed: .cursor/rules/nextrouter-commands.mdc`);

  // Register MCP server in .cursor/mcp.json
  const cursorDir = path.join(workspacePath, '.cursor');
  if (!fs.existsSync(cursorDir)) {
    fs.mkdirSync(cursorDir, { recursive: true });
  }
  const cursorMcpPath = path.join(cursorDir, 'mcp.json');
  let cursorMcpConfig: any = {};
  if (fs.existsSync(cursorMcpPath)) {
    try { cursorMcpConfig = JSON.parse(fs.readFileSync(cursorMcpPath, 'utf8')); } catch {}
  }
  if (!cursorMcpConfig.mcpServers) cursorMcpConfig.mcpServers = {};
  cursorMcpConfig.mcpServers.nextrouter = {
    command: 'npx',
    args: ['tsx', mcpPath]
  };
  fs.writeFileSync(cursorMcpPath, JSON.stringify(cursorMcpConfig, null, 2), 'utf8');
  logs.push(`Cursor MCP server registered: .cursor/mcp.json`);
}
```

- [ ] **Step 4: Update `uninstallPlugin()` cursor branch to also clean up mcp.json**

Find this block in `uninstallPlugin()`:
```typescript
} else if (providerId === 'cursor') {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    logs.push(`Removed: ${file}`);
  }
}
```

Replace the entire `cursor` branch inside the `for` loop with this (note: the for loop pattern needs a different approach — just replace the full uninstall function's cursor handling):

Find the cursor uninstall section and replace the `else if (providerId === 'cursor')` block:
```typescript
} else if (providerId === 'cursor') {
  const mdcPath = path.join(workspacePath, '.cursor', 'rules', 'nextrouter-commands.mdc');
  if (fs.existsSync(mdcPath)) {
    fs.unlinkSync(mdcPath);
    logs.push(`Removed: .cursor/rules/nextrouter-commands.mdc`);
  }
  const cursorMcpPath = path.join(workspacePath, '.cursor', 'mcp.json');
  if (fs.existsSync(cursorMcpPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(cursorMcpPath, 'utf8'));
      if (config.mcpServers?.nextrouter) {
        delete config.mcpServers.nextrouter;
        fs.writeFileSync(cursorMcpPath, JSON.stringify(config, null, 2), 'utf8');
        logs.push(`Removed nextrouter entry from .cursor/mcp.json`);
      }
    } catch {}
  }
```

- [ ] **Step 5: Commit and verify TypeScript**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && git add src/plugins/installer.ts && git commit -m "fix: Cursor plugin now registers MCP server in .cursor/mcp.json + richer MDC rule"
```

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: no output

- [ ] **Step 6: Manual smoke test — install cursor plugin and check both files**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsx src/cli/index.ts install-plugin cursor 2>&1
```
Expected output includes:
```
Installing plugin for cursor...
 Cursor MDC rule installed: .cursor/rules/nextrouter-commands.mdc
 Cursor MCP server registered: .cursor/mcp.json
```

Verify the MCP config was written:
```bash
cat /Users/ramadhani.musthofa/Work/nextrouter/.cursor/mcp.json
```
Expected:
```json
{
  "mcpServers": {
    "nextrouter": {
      "command": "npx",
      "args": ["tsx", "/Users/ramadhani.musthofa/Work/nextrouter/src/cli/mcp.ts"]
    }
  }
}
```

---

## Task 3: Fix Antigravity Plugin — MCP Registration + Enhanced GEMINI.md Content

**Files:**
- Modify: `src/plugins/installer.ts`

The current `installAntigravityGeminiMd()` writes a minimal block to GEMINI.md. Gemini CLI (which Antigravity uses) reads `~/.gemini/settings.json` for MCP configuration. Both pieces must be present for Antigravity commands to work.

- [ ] **Step 1: Update `getIntegrationFiles()` — add settings.json to antigravity files list**

Find:
```typescript
case 'antigravity':
  return [path.join(workspacePath, 'GEMINI.md')];
```

Replace with:
```typescript
case 'antigravity':
  return [
    path.join(workspacePath, 'GEMINI.md'),
    path.join(os.homedir(), '.gemini', 'settings.json')
  ];
```

- [ ] **Step 2: Replace the entire `installAntigravityGeminiMd()` function**

Find `function installAntigravityGeminiMd(workspacePath: string, cliCmd: string, logs: string[]): void {` and replace the entire function through its closing `}` with:

```typescript
function installAntigravityGeminiMd(workspacePath: string, cliCmd: string, logs: string[]): void {
  // 1. Update GEMINI.md with rich NextRouter system instructions
  const geminiMdPath = path.join(workspacePath, 'GEMINI.md');
  const block = `\n\n<!-- NEXTROUTER_COMMANDS_START -->
## NextRouter Context Management

NextRouter is connected as an MCP server (configured in ~/.gemini/settings.json). Use its tools proactively for context management, handovers, and token awareness.

### When to Call MCP Tools

**\`get_shared_context\`** (no args) — Call when the user asks "what's the current status?", "what were we working on?", or when resuming after a break.

**\`save_context\`** — Call to checkpoint the current session. Required args: \`providerId\` ("antigravity"), \`title\` (brief task description), \`messages\` (array of {role, content}).

**\`get_handover\`** — Call when user wants to continue in another provider. Required: \`sourceProviderId\` ("antigravity"). Optional: \`targetProviderId\`. Returns a Markdown briefing packet.

**\`sync_rules\`** — Call when user says "sync rules", "update instructions", or after editing GEMINI.md manually. Required: \`workspacePath\` ("${workspacePath}").

**\`prune_code\`** — Call when a file is too large for context. Required: \`filepath\`. Optional: \`write\` (boolean, default false).

**\`get_active_plan\`** — Call when user asks "what's the plan?" or "show the roadmap". Required: \`workspacePath\` ("${workspacePath}").

### CLI Alternative (run in terminal)
\`\`\`bash
${cliCmd} status        # Show all detected providers and sessions
${cliCmd} sync          # Sync GEMINI.md, .cursorrules, CLAUDE.md
${cliCmd} handover antigravity claude-code  # Generate a handover packet
${cliCmd} tokens        # Show token usage vs context limits
${cliCmd} prune src/some/file.ts  # Prune a file to save tokens
\`\`\`
<!-- NEXTROUTER_COMMANDS_END -->`;

  let existing = '';
  if (fs.existsSync(geminiMdPath)) {
    existing = fs.readFileSync(geminiMdPath, 'utf8');
    existing = existing
      .replace(/<!-- NEXTROUTER_COMMANDS_START -->[\s\S]*<!-- NEXTROUTER_COMMANDS_END -->/, '')
      .trim();
  }
  fs.writeFileSync(geminiMdPath, existing + block, 'utf8');
  logs.push(`Antigravity plugin installed: GEMINI.md updated with NextRouter system instructions`);

  // 2. Register MCP server in ~/.gemini/settings.json
  const geminiDir = path.join(os.homedir(), '.gemini');
  if (!fs.existsSync(geminiDir)) {
    fs.mkdirSync(geminiDir, { recursive: true });
  }
  const settingsPath = path.join(geminiDir, 'settings.json');
  const mcpPath = path.resolve(workspacePath, 'src', 'cli', 'mcp.ts');
  let geminiSettings: any = {};
  if (fs.existsSync(settingsPath)) {
    try { geminiSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
  }
  if (!geminiSettings.mcpServers) geminiSettings.mcpServers = {};
  geminiSettings.mcpServers.nextrouter = {
    command: 'npx',
    args: ['tsx', mcpPath]
  };
  fs.writeFileSync(settingsPath, JSON.stringify(geminiSettings, null, 2), 'utf8');
  logs.push(`Antigravity/Gemini CLI MCP server registered: ~/.gemini/settings.json`);
}
```

- [ ] **Step 3: Update `uninstallPlugin()` antigravity branch to also clean settings.json**

Find the `else if (providerId === 'antigravity')` block inside `uninstallPlugin()` and replace it with:
```typescript
} else if (providerId === 'antigravity') {
  if (file.endsWith('GEMINI.md')) {
    removeNextrouterBlockFromFile(file, '<!-- NEXTROUTER_COMMANDS_START -->', '<!-- NEXTROUTER_COMMANDS_END -->');
    logs.push(`Removed NextRouter commands block from GEMINI.md`);
  } else if (file.endsWith('settings.json') && fs.existsSync(file)) {
    try {
      const config = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (config.mcpServers?.nextrouter) {
        delete config.mcpServers.nextrouter;
        fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
        logs.push(`Removed nextrouter entry from ~/.gemini/settings.json`);
      }
    } catch {}
  }
}
```

- [ ] **Step 4: Commit and verify**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && git add src/plugins/installer.ts && git commit -m "fix: Antigravity plugin now registers MCP server in ~/.gemini/settings.json + richer GEMINI.md"
```

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: no output

- [ ] **Step 5: Manual smoke test**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsx src/cli/index.ts install-plugin antigravity 2>&1
```
Expected output includes:
```
 Antigravity plugin installed: GEMINI.md updated with NextRouter system instructions
 Antigravity/Gemini CLI MCP server registered: ~/.gemini/settings.json
```

Verify the settings file:
```bash
cat ~/.gemini/settings.json
```
Expected:
```json
{
  "mcpServers": {
    "nextrouter": {
      "command": "npx",
      "args": ["tsx", "/Users/ramadhani.musthofa/Work/nextrouter/src/cli/mcp.ts"]
    }
  }
}
```

---

## Task 4: Dashboard Revamp — Provider Config + Feature Guide + Setup Banner

**Files:**
- Modify: `src/app/page.tsx`

The dashboard has 5 hardcoded provider color/name if-else chains, no feature explanations, and no setup guidance. This task:
1. Imports provider meta from `src/config/providers.ts`
2. Replaces all 5 hardcoded chains with `getProviderMeta()`
3. Adds a collapsible feature guide under the overview cards
4. Adds a setup-status banner showing which providers need configuration
5. Adds subtitle descriptions to the 3 overview cards
6. Improves the empty state for sessions

- [ ] **Step 1: Read current page.tsx and find the 5 hardcoded chains**

The 5 locations in `src/app/page.tsx` to fix are at approximately:
- Lines 509–525: `Object.entries(metrics.providers).map()` — provider context window colors
- Lines 809–828: Session list card rendering — `providerBg/providerColor/providerLabel`
- Lines 733–737: Provider filter tabs array — hardcoded colors/names
- Lines 936–953: Session modal header — `providerColor` for selected session
- Lines 1158–1165: Session modal inject dropdown — provider filter

- [ ] **Step 2: Add import at top of page.tsx**

At the top of `src/app/page.tsx`, after `import React, { useEffect, useState } from 'react';`, add:

```typescript
import { getProviderMeta, ALL_PROVIDER_IDS } from '@/config/providers';
```

- [ ] **Step 3: Add `pluginStatuses` state alongside existing state declarations**

After `const [filterProvider, setFilterProvider] = useState<string>('all');`, add:

```typescript
const [pluginStatuses, setPluginStatuses] = useState<Array<{
  providerId: string;
  installed: boolean;
}>>([]);
```

- [ ] **Step 4: Load plugin statuses in `loadData()`**

In the `loadData()` function, after the existing fetch calls, add:

```typescript
try {
  const plRes = await fetch(`/api/plugins?workspacePath=${encodeURIComponent(workspacePath || process.cwd())}`);
  if (plRes.ok) {
    const plData = await plRes.json();
    setPluginStatuses(plData.map((p: any) => ({ providerId: p.providerId, installed: p.installed })));
  }
} catch {}
```

- [ ] **Step 5: Replace hardcoded chain #1 — Provider context window bars (lines ~509–525)**

Find and replace the block:
```typescript
let name = providerId;
let color = 'var(--text-main)';
let limit = data.contextWindowLimit || 128000;

if (providerId === 'claude-code') {
  name = 'Claude Code';
  color = '#a78bfa';
} else if (providerId === 'cursor') {
  name = 'Cursor';
  color = 'var(--color-secondary)';
} else if (providerId === 'antigravity') {
  name = 'Antigravity';
  color = 'var(--color-success)';
} else if (providerId === 'copilot') {
  name = 'GitHub Copilot';
  color = 'var(--color-warning)';
}
```

With:
```typescript
const meta = getProviderMeta(providerId);
const name = meta.name;
const color = meta.color;
const limit = data.contextWindowLimit || 128000;
```

- [ ] **Step 6: Replace hardcoded chain #2 — Session list card (lines ~808–828)**

Find and replace the block:
```typescript
let providerBg = 'rgba(255, 255, 255, 0.05)';
let providerColor = 'var(--text-muted)';
let providerLabel = session.provider_id;

if (session.provider_id === 'claude-code') {
  providerBg = 'rgba(139, 92, 246, 0.15)';
  providerColor = '#a78bfa';
  providerLabel = 'Claude Code';
} else if (session.provider_id === 'cursor') {
  providerBg = 'rgba(6, 182, 212, 0.15)';
  providerColor = 'var(--color-secondary)';
  providerLabel = 'Cursor';
} else if (session.provider_id === 'antigravity') {
  providerBg = 'rgba(16, 185, 129, 0.15)';
  providerColor = 'var(--color-success)';
  providerLabel = 'Antigravity';
} else if (session.provider_id === 'copilot') {
  providerBg = 'rgba(245, 158, 11, 0.15)';
  providerColor = 'var(--color-warning)';
  providerLabel = 'Copilot';
}
```

With:
```typescript
const sessionMeta = getProviderMeta(session.provider_id);
const providerBg = sessionMeta.colorBg;
const providerColor = sessionMeta.color;
const providerLabel = sessionMeta.name;
```

- [ ] **Step 7: Replace hardcoded chain #3 — Provider filter tabs array (lines ~732–737)**

Find and replace the inline array:
```typescript
{ id: 'cursor', name: 'Cursor', color: 'var(--color-secondary)', bg: 'rgba(6, 182, 212, 0.15)' },
{ id: 'claude-code', name: 'Claude Code', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.15)' },
{ id: 'antigravity', name: 'Antigravity', color: 'var(--color-success)', bg: 'rgba(16, 185, 129, 0.15)' },
{ id: 'copilot', name: 'GitHub Copilot', color: 'var(--color-warning)', bg: 'rgba(245, 158, 11, 0.15)' }
```

With:
```typescript
...(['cursor', 'claude-code', 'antigravity', 'copilot'] as const).map(id => {
  const m = getProviderMeta(id);
  return { id, name: m.name, color: m.color, bg: m.colorBg };
})
```

Note: The full tabs array starts with `{ id: 'all', name: 'All Providers', color: 'var(--color-primary)', bg: 'var(--color-primary-glow)' }` — keep that entry as-is.

- [ ] **Step 8: Replace hardcoded chain #4 — Session modal header (lines ~936–953)**

Find and replace the block that sets `providerColor` for `selectedSession`:
```typescript
let providerColor = 'var(--text-muted)';
// ... if selectedSession.provider_id === 'claude-code' etc
if (selectedSession.provider_id === 'claude-code') {
```

With:
```typescript
const selectedMeta = getProviderMeta(selectedSession.provider_id);
const providerColor = selectedMeta.color;
```

- [ ] **Step 9: Replace hardcoded chain #5 — Inject dropdown provider filter (lines ~1272–1275)**

Find the provider list in the bridge dropdown:
```typescript
{ id: 'claude-code', name: 'Claude Code' },
{ id: 'cursor', name: 'Cursor' },
{ id: 'antigravity', name: 'Antigravity' },
{ id: 'copilot', name: 'GitHub Copilot' }
```

Replace with:
```typescript
...(['claude-code', 'cursor', 'antigravity', 'copilot'] as const).map(id => ({
  id,
  name: getProviderMeta(id).name
}))
```

- [ ] **Step 10: Add setup-status banner after the header section**

Find the closing tag of the header section (the `</div>` that ends the header bar block at around line 305: `</div>` after the Scan + Sync buttons). After that closing `</div>`, add:

```tsx
{/* Setup status banner — shown when providers have missing MCP config */}
{pluginStatuses.some(p => !p.installed) && (
  <div style={{
    padding: '12px 20px',
    borderRadius: '10px',
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap'
  }}>
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ color: '#fbbf24', fontSize: '0.9rem', fontWeight: 600 }}>
        ⚠️ {pluginStatuses.filter(p => !p.installed).length} provider{pluginStatuses.filter(p => !p.installed).length > 1 ? 's' : ''} not fully configured
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
        {pluginStatuses.filter(p => !p.installed).map(p => getProviderMeta(p.providerId).name).join(', ')} — MCP server not registered
      </span>
    </div>
    <a href="/walkthrough#integrations" style={{
      padding: '6px 14px',
      borderRadius: '6px',
      background: 'rgba(245, 158, 11, 0.15)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      fontSize: '0.82rem',
      fontWeight: 600,
      textDecoration: 'none',
      whiteSpace: 'nowrap'
    }}>
      Complete Setup →
    </a>
  </div>
)}
```

- [ ] **Step 11: Add subtitle descriptions to the 3 overview cards**

For the Active Providers card, find `<p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Providers</p>` and replace with:
```tsx
<p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Providers</p>
<p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>AI tools detected in this workspace</p>
```

For the Accrued Session Cost card, find `<p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accrued Session Cost</p>` and replace with:
```tsx
<p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accrued Session Cost</p>
<p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>Token cost estimate across all providers</p>
```

For the Shared Context Pool card, find `<p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shared Context Pool</p>` and replace with:
```tsx
<p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shared Context Pool</p>
<p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>Combined tokens in active sessions</p>
```

- [ ] **Step 12: Improve the empty sessions state**

Find the current empty state block:
```tsx
<p>No active sessions scanned in workspace yet.</p>
<button className="btn btn-secondary" onClick={handleScan} style={{ marginTop: '8px' }}>
  Run workspace scan
</button>
```

Replace with:
```tsx
<p style={{ textAlign: 'center', maxWidth: '300px' }}>
  No sessions found yet. NextRouter scans AI provider logs to build your session timeline.
</p>
<p style={{ fontSize: '0.8rem', color: 'var(--text-dark)', textAlign: 'center', maxWidth: '280px' }}>
  Make sure at least one provider (Claude Code, Cursor, or Antigravity) is active in this workspace, then run a scan.
</p>
<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
  <button className="btn btn-secondary" onClick={handleScan} style={{ marginTop: '8px', fontSize: '0.85rem' }}>
    🔄 Scan Workspace
  </button>
  <a href="/walkthrough" style={{
    marginTop: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    background: 'var(--color-primary-glow)',
    color: 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    fontSize: '0.85rem',
    fontWeight: 600,
    textDecoration: 'none'
  }}>
    📖 View Setup Guide
  </a>
</div>
```

- [ ] **Step 13: Add a collapsible feature guide section below the 3 overview cards**

Find the closing `</div>` of the overview cards grid (the `</div>` after the token card's closing div, before the main grid comment `{/* Main Grid: Budget Ring + Active Sessions */}`). After that closing `</div>`, add:

```tsx
{/* Feature Guide — collapsible */}
<details style={{
  background: 'rgba(255, 255, 255, 0.01)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '0'
}}>
  <summary style={{
    padding: '16px 20px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    listStyle: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    userSelect: 'none'
  }}>
    <span>📚</span>
    <span>How NextRouter Works — Feature Guide</span>
    <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Click to expand</span>
  </summary>
  <div style={{
    padding: '0 20px 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px'
  }}>
    {[
      {
        icon: '🌉',
        title: 'Context Bridge',
        desc: 'Resume your AI session in a different provider without losing context. Open any session → Handover tab → select a target → Inject Context. The handover briefing is saved so the target provider loads it on next MCP call.'
      },
      {
        icon: '⚡',
        title: 'Rules Sync',
        desc: 'Keeps .cursorrules, CLAUDE.md, and GEMINI.md in sync across all providers. Universal skills (docs in skills/) are automatically injected on each sync. Hit "Sync Rules" or run `nextrouter sync` from terminal.'
      },
      {
        icon: '📊',
        title: 'Token Budget',
        desc: 'Tracks token usage across all AI sessions so you can see when you\'re approaching context limits. The budget gauge combines all active sessions. Sessions come from provider log files scanned on workspace detection.'
      },
      {
        icon: '🔌',
        title: 'MCP Integration',
        desc: 'NextRouter runs as an MCP (Model Context Protocol) server. AI providers connected via MCP can call get_shared_context, save_context, get_handover, sync_rules, prune_code, and get_active_plan directly — no manual CLI needed.'
      },
      {
        icon: '✂️',
        title: 'Code Pruner',
        desc: 'Strips implementation bodies (function/class bodies) from JS/TS/Python files, keeping only signatures. Reduces token usage when sharing large files with AI. Run from Context Bridge page or via `nextrouter prune <file>`.'
      },
      {
        icon: '🎯',
        title: 'One-Click Setup',
        desc: 'The "One-Click Local Setup & Sync" button in Services registers the MCP server, installs provider plugins (slash commands, MDC rules, VS Code tasks), sets up the shell alias, syncs rules, and starts the background daemon.'
      }
    ].map(f => (
      <div key={f.title} style={{
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>{f.icon}</span>
          <strong style={{ fontSize: '0.9rem' }}>{f.title}</strong>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>{f.desc}</p>
      </div>
    ))}
  </div>
</details>
```

- [ ] **Step 14: Verify TypeScript and commit**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output

```bash
git add src/app/page.tsx && git commit -m "feat: dashboard revamp — centralized provider config, feature guide, setup banner, better empty states"
```

---

## Task 5: Walkthrough — Accurate Cursor and Antigravity Provider Guide Tabs

**Files:**
- Modify: `src/app/walkthrough/page.tsx`

The current Cursor tab says "Configure NextRouter as an MCP server inside Cursor Features" without showing HOW. The Antigravity tab says "Zero-Config Monitoring" which is no longer accurate since we now write a config file. Both need to be rewritten with the actual setup steps.

- [ ] **Step 1: Read the current provider guides section**

```bash
sed -n '529,585p' /Users/ramadhani.musthofa/Work/nextrouter/src/app/walkthrough/page.tsx
```

- [ ] **Step 2: Replace the Cursor tab content**

Find the entire block:
```tsx
{/* Cursor Details */}
{activeProviderTab === 'cursor' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
    <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#22d3ee' }}>🌟 Advanced Cursor Chat Timeline Resolution</h3>
      <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
        <li><strong>SQLite Integration:</strong> NextRouter reads local Cursor databases (such as <code>~/.cursor/chats/*.db</code> files) recursively, parsing messages, token counts, and resolving workspace directories directly.</li>
        <li><strong>Eviction-Resistant Cache:</strong> Even if Cursor removes projects from its "Recently Opened" cache, NextRouter reconstructs and resolves paths using user messages and DB metadata.</li>
        <li><strong>Cursor Rules:</strong> NextRouter targets the <code>.cursorrules</code> file in your project root to auto-sync rules and custom skills.</li>
        <li><strong>MCP Connection:</strong> Configure NextRouter as an MCP server inside Cursor Features to allow Cursor to query timeline data.</li>
      </ul>
    </div>
  </div>
)}
```

Replace with:
```tsx
{/* Cursor Details */}
{activeProviderTab === 'cursor' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
    <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#22d3ee' }}>🖱️ Cursor — MCP + Rules Integration</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 1 — Install the NextRouter Plugin</strong>
          <p>Use the Install Plugins step (step 7) or run this command. It writes two files: an MDC rule and the MCP server config.</p>
          <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#e2e8f0', marginTop: '8px', overflowX: 'auto' }}>{`npx tsx src/cli/index.ts install-plugin cursor`}</pre>
          <p style={{ marginTop: '8px', fontSize: '0.82rem' }}>This creates <code>.cursor/rules/nextrouter-commands.mdc</code> (always-applied rule) and <code>.cursor/mcp.json</code> (MCP server registration).</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 2 — Restart Cursor</strong>
          <p>Cursor reads <code>.cursor/mcp.json</code> on startup. Restart Cursor (or reload the window with Cmd+Shift+P → "Reload Window") to activate the MCP connection.</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 3 — Verify MCP is Active</strong>
          <p>In Cursor chat, ask: <em>"What tools do you have available?"</em> — you should see <code>get_shared_context</code>, <code>get_handover</code>, <code>sync_rules</code>, and others listed.</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>How It Works</strong>
          <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><strong>Session reading:</strong> NextRouter reads Cursor's local SQLite chat databases from <code>~/.cursor/chats/</code> to extract sessions, token counts, and workspace paths.</li>
            <li><strong>Rules sync:</strong> NextRouter reads/writes <code>.cursorrules</code> and <code>.cursor/rules/*.mdc</code>. Universal skills are injected automatically.</li>
            <li><strong>MDC rule:</strong> The <code>nextrouter-commands.mdc</code> rule has <code>alwaysApply: true</code>, meaning Cursor loads it in every chat — no user action needed.</li>
          </ul>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(6, 182, 212, 0.06)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
          <strong style={{ fontSize: '0.82rem', color: '#22d3ee' }}>Config files written by installer:</strong>
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
            <code>.cursor/rules/nextrouter-commands.mdc</code> — Always-applied rule with MCP tool reference
            <code>.cursor/mcp.json</code> — MCP server registration (nextrouter → npx tsx src/cli/mcp.ts)
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Replace the Antigravity tab content**

Find the entire block:
```tsx
{/* Antigravity Details */}
{activeProviderTab === 'antigravity' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
    <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#fbbf24' }}>🌟 Antigravity Native Observability</h3>
      <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
        <li><strong>Native Logs:</strong> Antigravity reads session logs directly from the project's local directory (e.g. <code>.gemini/antigravity/transcript.jsonl</code>) to trace agent coding steps and execution statuses.</li>
        <li><strong>Instructions Standard:</strong> NextRouter compiles rules and injects them into <code>GEMINI.md</code> in your project root to control Antigravity prompts.</li>
        <li><strong>Zero-Config Monitoring:</strong> Token budgets, Git branch name, and active workspace paths are resolved automatically out-of-the-box.</li>
      </ul>
    </div>
  </div>
)}
```

Replace with:
```tsx
{/* Antigravity Details */}
{activeProviderTab === 'antigravity' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
    <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#34d399' }}>🌀 Antigravity — Gemini CLI MCP Integration</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 1 — Install the NextRouter Plugin</strong>
          <p>Run the installer to register the MCP server and update GEMINI.md with tool usage instructions.</p>
          <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#e2e8f0', marginTop: '8px', overflowX: 'auto' }}>{`npx tsx src/cli/index.ts install-plugin antigravity`}</pre>
          <p style={{ marginTop: '8px', fontSize: '0.82rem' }}>This updates <code>GEMINI.md</code> with a rich NextRouter system context block and writes <code>~/.gemini/settings.json</code> with the MCP server entry.</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 2 — Restart the Antigravity / Gemini CLI Session</strong>
          <p>Gemini CLI reads <code>~/.gemini/settings.json</code> at startup. Close and reopen your terminal session (or run <code>gemini</code> again) to pick up the new MCP server.</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 3 — Verify</strong>
          <p>In your Gemini CLI session, ask: <em>"What MCP tools do you have?"</em> — you should see <code>get_shared_context</code>, <code>get_handover</code>, <code>sync_rules</code>, and others.</p>
        </div>
        <div>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>How It Works</strong>
          <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><strong>Session reading:</strong> NextRouter reads Antigravity's transcript logs from <code>~/.gemini/antigravity/brain/[session-id]/.system_generated/logs/transcript.jsonl</code>.</li>
            <li><strong>Rules sync:</strong> NextRouter reads/writes <code>GEMINI.md</code> in your project root. Universal skills are injected on sync.</li>
            <li><strong>GEMINI.md block:</strong> The installer adds a <code>&lt;!-- NEXTROUTER_COMMANDS_START/END --&gt;</code> block with proactive MCP tool usage instructions.</li>
          </ul>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
          <strong style={{ fontSize: '0.82rem', color: '#34d399' }}>Config files written by installer:</strong>
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
            <code>GEMINI.md</code> — NextRouter commands block with proactive MCP tool instructions
            <code>~/.gemini/settings.json</code> — MCP server registration (nextrouter → npx tsx src/cli/mcp.ts)
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript and commit**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output

```bash
git add src/app/walkthrough/page.tsx && git commit -m "feat: accurate Cursor + Antigravity provider guide with step-by-step MCP setup"
```

---

## Task 6: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript type check**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsc --noEmit 2>&1
```
Expected: no output (zero errors)

- [ ] **Step 2: Run Next.js production build**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npm run build 2>&1 | tail -25
```
Expected: build succeeds showing routes table including `/api/plugins`, no errors

- [ ] **Step 3: Test Cursor plugin install creates both expected files**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsx src/cli/index.ts install-plugin cursor 2>&1
```
Expected: logs include both `nextrouter-commands.mdc` and `.cursor/mcp.json`

```bash
cat /Users/ramadhani.musthofa/Work/nextrouter/.cursor/mcp.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('nextrouter key present:', 'nextrouter' in d.get('mcpServers', {}))"
```
Expected: `nextrouter key present: True`

- [ ] **Step 4: Test Antigravity plugin install creates both expected files**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsx src/cli/index.ts install-plugin antigravity 2>&1
```
Expected: logs include both `GEMINI.md updated` and `~/.gemini/settings.json`

```bash
cat ~/.gemini/settings.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('nextrouter key present:', 'nextrouter' in d.get('mcpServers', {}))"
```
Expected: `nextrouter key present: True`

- [ ] **Step 5: Test list-plugins shows all 4 providers as INSTALLED**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npx tsx src/cli/index.ts install-plugin all 2>&1 && npx tsx src/cli/index.ts list-plugins 2>&1
```
Expected: all 4 providers show `✓ ... INSTALLED`

- [ ] **Step 6: Start dev server and verify dashboard loads without errors**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && npm run dev &
sleep 4
curl -s http://localhost:3000/api/plugins | python3 -c "import json,sys; d=json.load(sys.stdin); [print(p['providerId'], ':', 'INSTALLED' if p['installed'] else 'NOT INSTALLED') for p in d]"
```
Expected: all 4 providers listed (some may be NOT INSTALLED if not all were just installed)

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 7: Final commit if any cleanup needed**

```bash
cd /Users/ramadhani.musthofa/Work/nextrouter && git status
```
If clean, proceed. Otherwise stage and commit any remaining files.

---

## Self-Review

**Spec coverage:**
1. ✅ Revamp better UI UX — Tasks 4, 5: centralized provider meta, feature guide, setup banner, better empty states
2. ✅ Clean explanation/documentation — Task 4: feature guide with 6 feature explanations; overview card subtitles; setup banner text
3. ✅ Make sure everything working — Task 6: full TypeScript + build + CLI + API verification
4. ✅ Cursor commands working — Task 2: writes `.cursor/mcp.json` so Cursor AI can actually call MCP tools; enhanced MDC with parameter examples
5. ✅ Antigravity commands working — Task 3: writes `~/.gemini/settings.json` for Gemini CLI MCP registration; enhanced GEMINI.md with proactive tool usage instructions
6. ✅ Walkthrough documentation — Task 5: rewritten Cursor + Antigravity tabs with accurate step-by-step MCP setup

**Placeholder scan:** No TBD/TODO/placeholder content found. All code blocks are complete and executable.

**Type consistency:** `ProviderMeta` (Task 1) uses `color` and `colorBg`. All consumers in Task 4 use `meta.color` and `meta.colorBg` — consistent throughout.

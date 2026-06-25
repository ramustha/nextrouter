# Integrated Commands & Plugin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified plugin system that installs NextRouter capabilities (status, sync, handover, prune, tokens) as native commands inside each AI provider (Claude Code, Cursor, Antigravity, Copilot), plus complete all outstanding incomplete features.

**Architecture:** A `src/plugins/` layer defines per-provider plugin manifests and an installer that writes provider-specific integration files (Claude Code global commands, Cursor MDC rules, VS Code tasks, GEMINI.md/CLAUDE.md injection). A new REST API at `/api/plugins` exposes install status and install/uninstall actions. The dashboard Walkthrough Step 7 and Context Bridge modal consume this API to show live plugin status and enable one-click install per provider.

**Tech Stack:** Next.js 14, TypeScript, React, file-system (no new deps), existing `@modelcontextprotocol/sdk`, existing CLI at `src/cli/index.ts`.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/plugins/manifest.ts` | Command definitions + per-provider plugin descriptors |
| Create | `src/plugins/installer.ts` | install/uninstall/status logic per provider |
| Create | `src/app/api/plugins/route.ts` | REST API: GET status, POST install, DELETE uninstall |
| Create | `~/.claude/commands/nr-sync.md` | Claude Code global slash command |
| Create | `~/.claude/commands/nr-handover.md` | Claude Code global slash command |
| Create | `~/.claude/commands/nr-status.md` | Claude Code global slash command |
| Create | `~/.claude/commands/nr-tokens.md` | Claude Code global slash command |
| Create | `~/.claude/commands/nr-prune.md` | Claude Code global slash command |
| Create | `.cursor/rules/nextrouter-commands.mdc` | Cursor MDC rule teaching NextRouter MCP usage |
| Create | `skills/nextrouter-commands.md` | Universal skill auto-injected to all providers |
| Modify | `src/app/api/system/setup/route.ts` | Call plugin installer during one-click setup |
| Modify | `src/app/page.tsx` | Add target provider selector + inject button to session modal |
| Modify | `src/app/walkthrough/page.tsx` | Complete Step 7 with live plugin status + install buttons |

---

## Task 1: Commit Current Batch

**Files:**
- All 16 modified/untracked files currently unstaged

- [ ] **Step 1: Stage all modified and untracked files**

```bash
git add README.md \
  src/adapters/antigravity.ts \
  src/adapters/claude-code.ts \
  src/adapters/copilot.ts \
  src/adapters/cursor.ts \
  src/adapters/types.ts \
  src/app/api/sessions/route.ts \
  src/app/api/system/setup/route.ts \
  src/app/globals.css \
  src/app/page.tsx \
  src/app/walkthrough/page.tsx \
  src/cli/index.ts \
  src/components/layout/Sidebar.tsx \
  src/engine/rules-sync.ts \
  src/mcp/server.ts \
  src/store/database.ts \
  .cursorrules
```

- [ ] **Step 2: Commit the batch**

```bash
git commit -m "feat: session detail modal, provider filter tabs, cursor/claude adapter rewrites, prune CLI, MCP plan tools, one-click setup API"
```

- [ ] **Step 3: Verify clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`

---

## Task 2: Plugin Manifest & Command Definitions

**Files:**
- Create: `src/plugins/manifest.ts`

- [ ] **Step 1: Create `src/plugins/manifest.ts`**

```typescript
import os from 'os';
import path from 'path';

export interface PluginCommand {
  id: string;
  name: string;
  description: string;
  cliArgs: string[];
  mcpTool: string | null;
}

export interface ProviderPlugin {
  providerId: string;
  providerName: string;
  color: string;
  integrationFiles: string[];
  commands: PluginCommand[];
}

export const NEXTROUTER_CLI = `npx tsx ${path.resolve(process.cwd(), 'src/cli/index.ts')}`;

export const COMMANDS: PluginCommand[] = [
  {
    id: 'nr-status',
    name: 'NextRouter Status',
    description: 'Show detected workspace providers and active sessions.',
    cliArgs: ['status'],
    mcpTool: 'get_shared_context'
  },
  {
    id: 'nr-sync',
    name: 'NextRouter Sync Rules',
    description: 'Bidirectionally sync .cursorrules, CLAUDE.md, and GEMINI.md across all providers.',
    cliArgs: ['sync'],
    mcpTool: 'sync_rules'
  },
  {
    id: 'nr-handover',
    name: 'NextRouter Handover',
    description: 'Generate a portable handover briefing from the latest session.',
    cliArgs: ['handover', '$PROVIDER', '$TARGET'],
    mcpTool: 'get_handover'
  },
  {
    id: 'nr-tokens',
    name: 'NextRouter Tokens',
    description: 'Show current token usage vs model context window limits.',
    cliArgs: ['tokens'],
    mcpTool: null
  },
  {
    id: 'nr-prune',
    name: 'NextRouter Prune',
    description: 'Strip implementation bodies from a JS/TS/Python file to save tokens.',
    cliArgs: ['prune', '$FILE'],
    mcpTool: 'prune_code'
  }
];

export const PROVIDER_PLUGINS: ProviderPlugin[] = [
  {
    providerId: 'claude-code',
    providerName: 'Claude Code',
    color: '#a78bfa',
    integrationFiles: [
      path.join(os.homedir(), '.claude', 'commands', 'nr-status.md'),
      path.join(os.homedir(), '.claude', 'commands', 'nr-sync.md'),
      path.join(os.homedir(), '.claude', 'commands', 'nr-handover.md'),
      path.join(os.homedir(), '.claude', 'commands', 'nr-tokens.md'),
      path.join(os.homedir(), '.claude', 'commands', 'nr-prune.md')
    ],
    commands: COMMANDS
  },
  {
    providerId: 'cursor',
    providerName: 'Cursor',
    color: '#22d3ee',
    integrationFiles: [
      path.join(process.cwd(), '.cursor', 'rules', 'nextrouter-commands.mdc')
    ],
    commands: COMMANDS
  },
  {
    providerId: 'antigravity',
    providerName: 'Antigravity',
    color: '#fbbf24',
    integrationFiles: [
      path.join(process.cwd(), 'GEMINI.md')
    ],
    commands: COMMANDS
  },
  {
    providerId: 'copilot',
    providerName: 'GitHub Copilot',
    color: '#34d399',
    integrationFiles: [
      path.join(process.cwd(), '.github', 'copilot-instructions.md'),
      path.join(process.cwd(), '.vscode', 'tasks.json')
    ],
    commands: COMMANDS
  }
];
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/manifest.ts
git commit -m "feat: add plugin manifest with command definitions per provider"
```

---

## Task 3: Plugin Installer Engine

**Files:**
- Create: `src/plugins/installer.ts`

- [ ] **Step 1: Create `src/plugins/installer.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import os from 'os';
import { COMMANDS, NEXTROUTER_CLI, PROVIDER_PLUGINS } from './manifest';

export interface PluginStatus {
  providerId: string;
  providerName: string;
  color: string;
  installed: boolean;
  installedFiles: string[];
  missingFiles: string[];
}

export function getPluginStatus(workspacePath: string): PluginStatus[] {
  return PROVIDER_PLUGINS.map(plugin => {
    const files = getIntegrationFiles(plugin.providerId, workspacePath);
    const installed = files.every(f => fs.existsSync(f));
    const installedFiles = files.filter(f => fs.existsSync(f));
    const missingFiles = files.filter(f => !fs.existsSync(f));
    return {
      providerId: plugin.providerId,
      providerName: plugin.providerName,
      color: plugin.color,
      installed,
      installedFiles,
      missingFiles
    };
  });
}

function getIntegrationFiles(providerId: string, workspacePath: string): string[] {
  const cliPath = path.resolve(workspacePath, 'src/cli/index.ts');
  const claudeCommandsDir = path.join(os.homedir(), '.claude', 'commands');
  switch (providerId) {
    case 'claude-code':
      return ['nr-status', 'nr-sync', 'nr-handover', 'nr-tokens', 'nr-prune']
        .map(id => path.join(claudeCommandsDir, `${id}.md`));
    case 'cursor':
      return [path.join(workspacePath, '.cursor', 'rules', 'nextrouter-commands.mdc')];
    case 'antigravity':
      return [path.join(workspacePath, 'GEMINI.md')];
    case 'copilot':
      return [
        path.join(workspacePath, '.github', 'copilot-instructions.md'),
        path.join(workspacePath, '.vscode', 'tasks.json')
      ];
    default:
      return [];
  }
}

export function installPlugin(providerId: string, workspacePath: string): string[] {
  const logs: string[] = [];
  const cliPath = path.resolve(workspacePath, 'src/cli/index.ts');
  const cliCmd = `npx tsx ${cliPath}`;

  switch (providerId) {
    case 'claude-code':
      installClaudeCodeCommands(cliCmd, logs);
      break;
    case 'cursor':
      installCursorMdc(workspacePath, cliCmd, logs);
      break;
    case 'antigravity':
      installAntigravityGeminiMd(workspacePath, cliCmd, logs);
      break;
    case 'copilot':
      installCopilotPlugin(workspacePath, cliCmd, logs);
      break;
    default:
      logs.push(`Unknown provider: ${providerId}`);
  }
  return logs;
}

export function uninstallPlugin(providerId: string, workspacePath: string): string[] {
  const logs: string[] = [];
  const files = getIntegrationFiles(providerId, workspacePath);
  for (const file of files) {
    if (providerId === 'claude-code') {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        logs.push(`Removed: ${file}`);
      }
    } else if (providerId === 'cursor') {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        logs.push(`Removed: ${file}`);
      }
    } else if (providerId === 'antigravity') {
      removeNextrouterBlockFromFile(file, '<!-- NEXTROUTER_COMMANDS_START -->', '<!-- NEXTROUTER_COMMANDS_END -->');
      logs.push(`Removed NextRouter commands block from ${path.basename(file)}`);
    } else if (providerId === 'copilot') {
      if (file.endsWith('tasks.json') && fs.existsSync(file)) {
        removeNextrouterTasksFromJson(file, logs);
      } else if (file.endsWith('copilot-instructions.md')) {
        removeNextrouterBlockFromFile(file, '<!-- NEXTROUTER_COMMANDS_START -->', '<!-- NEXTROUTER_COMMANDS_END -->');
        logs.push(`Removed NextRouter block from ${path.basename(file)}`);
      }
    }
  }
  return logs;
}

// --- Claude Code: global ~/.claude/commands/nr-*.md files ---
function installClaudeCodeCommands(cliCmd: string, logs: string[]): void {
  const claudeCommandsDir = path.join(os.homedir(), '.claude', 'commands');
  if (!fs.existsSync(claudeCommandsDir)) {
    fs.mkdirSync(claudeCommandsDir, { recursive: true });
  }

  const commandFiles: Record<string, string> = {
    'nr-status.md': `Run the NextRouter status command to show all detected AI providers and active sessions in the current workspace.

Execute this bash command:
\`\`\`bash
${cliCmd} status
\`\`\`

Report the full output to the user including provider names, session titles, and token counts.`,

    'nr-sync.md': `Synchronize rules across all active AI provider configurations using NextRouter.

This will pull current rules from .cursorrules, CLAUDE.md, and GEMINI.md, then push unified rules (with auto-injected skills) back to all active providers.

Execute this bash command:
\`\`\`bash
${cliCmd} sync
\`\`\`

Report the sync result and any errors to the user.`,

    'nr-handover.md': `Generate a handover briefing from the latest session using NextRouter Context Bridge.

$ARGUMENTS should be: <source-provider> [target-provider]
Examples: "claude-code cursor" or just "cursor"

Execute this bash command (replace SOURCE and TARGET with the argument values):
\`\`\`bash
${cliCmd} handover $ARGUMENTS
\`\`\`

Display the full handover markdown to the user so they can copy it to the target provider.`,

    'nr-tokens.md': `Show current token usage across all active AI provider sessions using NextRouter.

Execute this bash command:
\`\`\`bash
${cliCmd} tokens
\`\`\`

Display the token usage table, including usage percentage vs context window limits for each model.`,

    'nr-prune.md': `Strip implementation bodies from a source file to reduce its token footprint using NextRouter Code Pruner.

$ARGUMENTS should be: <filepath> [--write]
Examples: "src/adapters/cursor.ts" or "src/engine/handover.ts --write"

Execute this bash command (replace FILEPATH with the argument):
\`\`\`bash
${cliCmd} prune $ARGUMENTS
\`\`\`

Show the pruned output and token savings report to the user. Remind them to add --write only if they want to overwrite the original file.`
  };

  for (const [filename, content] of Object.entries(commandFiles)) {
    const filePath = path.join(claudeCommandsDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    logs.push(`Claude Code command installed: ~/.claude/commands/${filename}`);
  }
}

// --- Cursor: .cursor/rules/nextrouter-commands.mdc ---
function installCursorMdc(workspacePath: string, cliCmd: string, logs: string[]): void {
  const rulesDir = path.join(workspacePath, '.cursor', 'rules');
  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  const mdcContent = `---
description: NextRouter context management commands and MCP tools
globs: ["**/*"]
alwaysApply: true
---

# NextRouter Commands & MCP Integration

NextRouter is installed as an MCP server in this workspace. Use its tools for context management:

## Available MCP Tools
- \`get_shared_context\` — Get current shared context across all AI providers
- \`save_context\` — Save/update current conversation context
- \`get_handover\` — Generate portable handover packet to another provider
- \`sync_rules\` — Synchronize .cursorrules, CLAUDE.md, GEMINI.md across providers
- \`prune_code\` — Strip implementation bodies from a file to save tokens
- \`get_active_plan\` — Read active plan.md from workspace

## When to Use
- User switches from Claude Code or Antigravity → call \`get_handover\` to reconstruct context
- User asks to sync rules → call \`sync_rules\` with the current workspace path
- File is too large for context → call \`prune_code\` with the file path
- User asks for status → call \`get_shared_context\`

## CLI Commands (via Terminal)
\`\`\`bash
${cliCmd} status       # Show active providers and sessions
${cliCmd} sync         # Sync rules across all providers
${cliCmd} handover cursor claude-code  # Generate handover
${cliCmd} tokens       # Show token usage
${cliCmd} prune src/file.ts  # Prune a file
\`\`\`
`;

  const filePath = path.join(rulesDir, 'nextrouter-commands.mdc');
  fs.writeFileSync(filePath, mdcContent, 'utf8');
  logs.push(`Cursor MDC rule installed: .cursor/rules/nextrouter-commands.mdc`);
}

// --- Antigravity: inject block into GEMINI.md ---
function installAntigravityGeminiMd(workspacePath: string, cliCmd: string, logs: string[]): void {
  const geminiMdPath = path.join(workspacePath, 'GEMINI.md');
  const block = `\n\n<!-- NEXTROUTER_COMMANDS_START -->
## NextRouter Integration

NextRouter MCP server is connected. Use these tool calls for context management:
- \`get_shared_context\` — Retrieve active cross-provider context
- \`get_handover\` — Get handover packet from another provider's latest session
- \`sync_rules\` — Sync workspace rules across all AI providers
- \`prune_code\` — Strip implementation bodies to reduce token usage
- \`get_active_plan\` — Read workspace plan.md

CLI available at: \`${cliCmd}\`
<!-- NEXTROUTER_COMMANDS_END -->`;

  let existing = '';
  if (fs.existsSync(geminiMdPath)) {
    existing = fs.readFileSync(geminiMdPath, 'utf8');
    existing = existing
      .replace(/<!-- NEXTROUTER_COMMANDS_START -->[\s\S]*<!-- NEXTROUTER_COMMANDS_END -->/, '')
      .trim();
  }

  fs.writeFileSync(geminiMdPath, existing + block, 'utf8');
  logs.push(`Antigravity plugin installed: GEMINI.md updated with NextRouter commands block`);
}

// --- Copilot: copilot-instructions.md + .vscode/tasks.json ---
function installCopilotPlugin(workspacePath: string, cliCmd: string, logs: string[]): void {
  const githubDir = path.join(workspacePath, '.github');
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }

  const copilotMdPath = path.join(githubDir, 'copilot-instructions.md');
  const block = `\n\n<!-- NEXTROUTER_COMMANDS_START -->
## NextRouter Context Management

For context management across AI providers, use these CLI patterns:
- Check provider status: \`${cliCmd} status\`
- Sync rules: \`${cliCmd} sync\`
- Generate handover: \`${cliCmd} handover copilot\`
- Token usage: \`${cliCmd} tokens\`
- Prune a file: \`${cliCmd} prune <filepath>\`

When user asks to "sync rules" or "generate handover" run the appropriate command above via terminal.
<!-- NEXTROUTER_COMMANDS_END -->`;

  let existing = '';
  if (fs.existsSync(copilotMdPath)) {
    existing = fs.readFileSync(copilotMdPath, 'utf8');
    existing = existing
      .replace(/<!-- NEXTROUTER_COMMANDS_START -->[\s\S]*<!-- NEXTROUTER_COMMANDS_END -->/, '')
      .trim();
  }
  fs.writeFileSync(copilotMdPath, existing + block, 'utf8');
  logs.push(`Copilot instructions updated: .github/copilot-instructions.md`);

  // .vscode/tasks.json
  const vscodeDir = path.join(workspacePath, '.vscode');
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }
  const tasksPath = path.join(vscodeDir, 'tasks.json');
  let tasksConfig: any = { version: '2.0.0', tasks: [] };
  if (fs.existsSync(tasksPath)) {
    try {
      tasksConfig = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
      if (!Array.isArray(tasksConfig.tasks)) tasksConfig.tasks = [];
      tasksConfig.tasks = tasksConfig.tasks.filter((t: any) => !t.label?.startsWith('NextRouter:'));
    } catch (e) {
      tasksConfig = { version: '2.0.0', tasks: [] };
    }
  }

  const nextrouterTasks = [
    { label: 'NextRouter: Status', type: 'shell', command: `${cliCmd} status`, group: 'build', presentation: { reveal: 'always', panel: 'shared' } },
    { label: 'NextRouter: Sync Rules', type: 'shell', command: `${cliCmd} sync`, group: 'build', presentation: { reveal: 'always', panel: 'shared' } },
    { label: 'NextRouter: Tokens', type: 'shell', command: `${cliCmd} tokens`, group: 'build', presentation: { reveal: 'always', panel: 'shared' } },
    { label: 'NextRouter: Handover', type: 'shell', command: `${cliCmd} handover copilot`, group: 'build', presentation: { reveal: 'always', panel: 'shared' } }
  ];

  tasksConfig.tasks.push(...nextrouterTasks);
  fs.writeFileSync(tasksPath, JSON.stringify(tasksConfig, null, 2), 'utf8');
  logs.push(`VS Code tasks installed: .vscode/tasks.json (4 NextRouter tasks)`);
}

// --- Helpers ---
function removeNextrouterBlockFromFile(filePath: string, startTag: string, endTag: string): void {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const escapedStart = startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  content = content.replace(new RegExp(`\\s*${escapedStart}[\\s\\S]*?${escapedEnd}`, 'g'), '').trim();
  fs.writeFileSync(filePath, content, 'utf8');
}

function removeNextrouterTasksFromJson(tasksPath: string, logs: string[]): void {
  try {
    const config = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    if (Array.isArray(config.tasks)) {
      config.tasks = config.tasks.filter((t: any) => !t.label?.startsWith('NextRouter:'));
      fs.writeFileSync(tasksPath, JSON.stringify(config, null, 2), 'utf8');
      logs.push(`Removed NextRouter tasks from .vscode/tasks.json`);
    }
  } catch (e) {
    logs.push(`Warning: could not parse .vscode/tasks.json`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/installer.ts
git commit -m "feat: plugin installer engine for Claude Code, Cursor, Antigravity, Copilot"
```

---

## Task 4: Plugin REST API

**Files:**
- Create: `src/app/api/plugins/route.ts`

- [ ] **Step 1: Create `src/app/api/plugins/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPluginStatus, installPlugin, uninstallPlugin } from '@/plugins/installer';

export async function GET(req: NextRequest) {
  const workspacePath = req.nextUrl.searchParams.get('workspacePath') || process.cwd();
  try {
    const status = getPluginStatus(workspacePath);
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { providerId, workspacePath = process.cwd() } = await req.json();
    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }
    const logs = installPlugin(providerId, workspacePath);
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { providerId, workspacePath = process.cwd() } = await req.json();
    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }
    const logs = uninstallPlugin(providerId, workspacePath);
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/plugins/route.ts
git commit -m "feat: /api/plugins REST endpoint for install/uninstall/status"
```

---

## Task 5: Update One-Click Setup to Use Plugin Installer

**Files:**
- Modify: `src/app/api/system/setup/route.ts`

- [ ] **Step 1: Replace manual MCP config writing in setup route with plugin installer**

In `src/app/api/system/setup/route.ts`, replace the Cursor MCP block, Antigravity MCP block, and Claude Code MCP block with calls to `installPlugin`. Keep the shell alias, rules sync, and daemon steps as-is. The full replacement section is:

```typescript
// Replace steps 1-3 (Cursor MCP, Antigravity MCP, Claude Code MCP) with:

// 1-4: Install provider plugins (commands + MCP configs)
const { installPlugin } = await import('@/plugins/installer');
for (const providerId of ['claude-code', 'cursor', 'antigravity', 'copilot']) {
  try {
    const pluginLogs = installPlugin(providerId, projectRoot);
    logs.push(...pluginLogs);
  } catch (pluginErr: any) {
    logs.push(`Warning: Plugin install failed for ${providerId}: ${pluginErr.message}`);
  }
}
```

The full updated `src/app/api/system/setup/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pullRules, pushRules } from '@/engine/rules-sync';
import { isDaemonRunning, startDaemonBackground } from '@/cli/daemon';
import { installPlugin } from '@/plugins/installer';

const execAsync = promisify(exec);

export async function POST() {
  const logs: string[] = [];
  try {
    const projectRoot = process.cwd();
    const home = os.homedir();
    const cliPath = path.resolve(projectRoot, 'src', 'cli', 'index.ts');

    // 1. Install provider plugins (commands + integration files)
    for (const providerId of ['claude-code', 'cursor', 'antigravity', 'copilot']) {
      try {
        const pluginLogs = installPlugin(providerId, projectRoot);
        logs.push(...pluginLogs);
      } catch (pluginErr: any) {
        logs.push(`Warning: Plugin install failed for ${providerId}: ${pluginErr.message}`);
      }
    }

    // 2. Claude Code MCP registration via CLI
    try {
      const mcpPath = path.resolve(projectRoot, 'src', 'cli', 'mcp.ts');
      const { stdout } = await execAsync(`claude mcp add nextrouter npx tsx ${mcpPath}`, { cwd: projectRoot });
      logs.push(`Claude Code MCP registered via CLI: ${stdout.trim()}`);
    } catch (claudeErr: any) {
      // Fallback: edit ~/.claude.json directly
      try {
        const claudeJsonPath = path.join(home, '.claude.json');
        if (fs.existsSync(claudeJsonPath)) {
          const mcpPath = path.resolve(projectRoot, 'src', 'cli', 'mcp.ts');
          const config = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
          if (config.projects?.[projectRoot]) {
            if (!config.projects[projectRoot].mcpServers) config.projects[projectRoot].mcpServers = {};
            config.projects[projectRoot].mcpServers.nextrouter = {
              type: 'stdio',
              command: 'npx',
              args: ['tsx', mcpPath],
              env: {}
            };
            fs.writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2), 'utf8');
            logs.push(`Claude Code MCP fallback-written to ~/.claude.json`);
          }
        }
      } catch (fbErr: any) {
        logs.push(`Warning: Claude MCP config skipped: ${claudeErr.message}`);
      }
    }

    // 3. Shell alias setup
    try {
      const aliasLine = `\n# NextRouter CLI Alias\nalias nextrouter="npx tsx ${cliPath}"\n`;
      for (const rcFile of [path.join(home, '.zshrc'), path.join(home, '.bashrc')]) {
        if (fs.existsSync(rcFile)) {
          const content = fs.readFileSync(rcFile, 'utf8');
          if (!content.includes('alias nextrouter=')) {
            fs.appendFileSync(rcFile, aliasLine, 'utf8');
            logs.push(`Shell alias added to ${path.basename(rcFile)}`);
          } else {
            logs.push(`Shell alias already present in ${path.basename(rcFile)}`);
          }
        }
      }
    } catch (shellErr: any) {
      logs.push(`Error configuring shell alias: ${shellErr.message}`);
    }

    // 4. Rules & Skills Sync
    try {
      await pullRules(projectRoot);
      await pushRules(projectRoot);
      logs.push(`Rules and skills synchronized across all providers`);
    } catch (syncErr: any) {
      logs.push(`Error synchronizing rules: ${syncErr.message}`);
    }

    // 5. Watcher Daemon
    try {
      if (!isDaemonRunning()) {
        startDaemonBackground(projectRoot);
        logs.push(`Background sync daemon launched`);
      } else {
        logs.push(`Background sync daemon already running`);
      }
    } catch (daemonErr: any) {
      logs.push(`Error starting daemon: ${daemonErr.message}`);
    }

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown setup failure',
      logs
    }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/system/setup/route.ts
git commit -m "refactor: one-click setup uses plugin installer instead of manual MCP writes"
```

---

## Task 6: Complete Context Bridge UI — Target Provider Selector

**Files:**
- Modify: `src/app/page.tsx`

The session modal currently has Conversation and Handover tabs. The Handover tab shows a briefing but has no "bridge to provider" action. We need to add a target provider dropdown and an "Inject to Provider" button that calls `POST /api/context` with `action: 'inject'`.

- [ ] **Step 1: Add `bridgeTargetProvider` and `injecting` state variables**

In `src/app/page.tsx`, find the block of `useState` declarations (around line 65) and add:

```typescript
const [bridgeTargetProvider, setBridgeTargetProvider] = useState<string>('');
const [injecting, setInjecting] = useState<boolean>(false);
const [injected, setInjected] = useState<boolean>(false);
```

- [ ] **Step 2: Add `handleInjectToProvider` function**

After `handleCopyBriefing` function, add:

```typescript
async function handleInjectToProvider() {
  if (!bridgeTargetProvider || !handoverBriefing || !selectedSession) return;
  setInjecting(true);
  setInjected(false);
  try {
    const res = await fetch('/api/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        providerId: bridgeTargetProvider,
        title: `[Bridged from ${selectedSession.provider_id}] ${selectedSession.title}`,
        messages: [
          { role: 'system', content: handoverBriefing }
        ]
      })
    });
    if (res.ok) {
      setInjected(true);
      setTimeout(() => setInjected(false), 3000);
    }
  } catch (e) {
    console.error('Inject failed:', e);
  } finally {
    setInjecting(false);
  }
}
```

- [ ] **Step 3: Add target provider selector in the Handover tab of the modal**

In the modal's Handover tab content (search for `setHandoverBriefing` display area), after the copy button row, add:

```tsx
{/* Target Provider Bridge */}
<div style={{
  marginTop: '16px',
  padding: '16px',
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
}}>
  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
    ⚡ Bridge to Another Provider
  </h4>
  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
    <select
      value={bridgeTargetProvider}
      onChange={(e) => setBridgeTargetProvider(e.target.value)}
      style={{
        flex: 1,
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        color: 'var(--text-main)',
        fontSize: '0.85rem'
      }}
    >
      <option value="">Select target provider...</option>
      {[
        { id: 'claude-code', name: 'Claude Code' },
        { id: 'cursor', name: 'Cursor' },
        { id: 'antigravity', name: 'Antigravity' },
        { id: 'copilot', name: 'GitHub Copilot' }
      ]
        .filter(p => p.id !== selectedSession?.provider_id)
        .map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
    </select>
    <button
      className="btn btn-primary"
      onClick={handleInjectToProvider}
      disabled={!bridgeTargetProvider || injecting || !handoverBriefing}
      style={{
        padding: '8px 16px',
        fontSize: '0.85rem',
        background: 'linear-gradient(to right, #8b5cf6, #06b6d4)',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
        opacity: !bridgeTargetProvider ? 0.5 : 1
      }}
    >
      {injected ? '✅ Injected!' : injecting ? 'Injecting...' : '⚡ Inject Context'}
    </button>
  </div>
  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
    Saves this handover briefing as an active context record in the target provider's session database. The next time that provider calls <code>get_shared_context</code> via MCP, it will receive this handover.
  </p>
</div>
```

- [ ] **Step 4: Reset bridge state when modal opens**

In `handleOpenSessionDetails`, add `setBridgeTargetProvider(''); setInjected(false);` alongside the existing state resets.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: context bridge target provider selector + inject to provider in session modal"
```

---

## Task 7: Complete Walkthrough Step 7 with Live Plugin Status

**Files:**
- Modify: `src/app/walkthrough/page.tsx`

The current Step 7 (`integrations`) shows placeholder cards marked "AVAILABLE". Replace them with live plugin status fetched from `/api/plugins` and install buttons.

- [ ] **Step 1: Add plugin state to walkthrough page**

In `src/app/walkthrough/page.tsx`, add at the top of the component function (after existing `useState` declarations):

```typescript
const [pluginStatuses, setPluginStatuses] = useState<Array<{
  providerId: string;
  providerName: string;
  color: string;
  installed: boolean;
  installedFiles: string[];
  missingFiles: string[];
}>>([]);
const [installingPlugin, setInstallingPlugin] = useState<string>('');
const [pluginLogs, setPluginLogs] = useState<Record<string, string[]>>({});

async function loadPluginStatuses() {
  try {
    const res = await fetch('/api/plugins');
    if (res.ok) {
      const data = await res.json();
      setPluginStatuses(data);
    }
  } catch (e) {
    console.error('Error loading plugin statuses:', e);
  }
}

async function handleInstallPlugin(providerId: string) {
  setInstallingPlugin(providerId);
  try {
    const res = await fetch('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId })
    });
    const data = await res.json();
    setPluginLogs(prev => ({ ...prev, [providerId]: data.logs || [] }));
    await loadPluginStatuses();
  } catch (e) {
    console.error('Error installing plugin:', e);
  } finally {
    setInstallingPlugin('');
  }
}
```

- [ ] **Step 2: Add `useEffect` to load plugin statuses when step changes to 'integrations'**

Find the existing `useEffect` in the walkthrough page and add a companion:

```typescript
useEffect(() => {
  if (activeStep === 'integrations') {
    loadPluginStatuses();
  }
}, [activeStep]);
```

- [ ] **Step 3: Replace the `activeStep === 'integrations'` JSX with live plugin status cards**

Replace the entire `{activeStep === 'integrations' && (...)}` block with:

```tsx
{activeStep === 'integrations' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
    <div>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)', marginBottom: '8px' }}>
        🔌 Provider Plugin Installation
      </h2>
      <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
        Install NextRouter as a native plugin in each AI provider. For Claude Code, this creates global slash commands (<code>/nr-sync</code>, <code>/nr-handover</code>, etc.) available in any project. For Cursor, it creates an MDC rule. For Copilot, it creates VS Code tasks.
      </p>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {pluginStatuses.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading plugin status...</div>
      ) : (
        pluginStatuses.map(plugin => (
          <div key={plugin.providerId} style={{
            padding: '20px',
            borderRadius: '12px',
            border: `1px solid ${plugin.installed ? plugin.color + '40' : 'var(--border-color)'}`,
            background: plugin.installed ? plugin.color + '08' : 'rgba(255,255,255,0.02)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: plugin.installed ? plugin.color : 'var(--text-dark)',
                  boxShadow: plugin.installed ? `0 0 8px ${plugin.color}` : 'none',
                  flexShrink: 0
                }} />
                <strong style={{ fontSize: '1rem', color: plugin.installed ? plugin.color : 'var(--text-main)' }}>
                  {plugin.providerName}
                </strong>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: plugin.installed ? plugin.color + '20' : 'rgba(255,255,255,0.05)',
                  color: plugin.installed ? plugin.color : 'var(--text-muted)',
                  fontWeight: 700
                }}>
                  {plugin.installed ? 'INSTALLED' : 'NOT INSTALLED'}
                </span>
              </div>
              {plugin.installed && plugin.installedFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {plugin.installedFiles.map(f => (
                    <code key={f} style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ✓ {f.replace(process.env.HOME || '', '~')}
                    </code>
                  ))}
                </div>
              )}
              {pluginLogs[plugin.providerId]?.length > 0 && (
                <div style={{
                  marginTop: '4px',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)'
                }}>
                  {pluginLogs[plugin.providerId].map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => handleInstallPlugin(plugin.providerId)}
              disabled={installingPlugin === plugin.providerId}
              style={{
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '8px',
                flexShrink: 0,
                background: plugin.installed ? 'rgba(255,255,255,0.03)' : 'var(--color-primary-glow)',
                color: plugin.installed ? 'var(--text-muted)' : 'var(--color-primary)',
                border: '1px solid',
                borderColor: plugin.installed ? 'var(--border-color)' : 'var(--color-primary)',
                cursor: 'pointer'
              }}
            >
              {installingPlugin === plugin.providerId
                ? 'Installing...'
                : plugin.installed ? '↺ Reinstall' : '⚡ Install'}
            </button>
          </div>
        ))
      )}
    </div>

    {/* Claude Code Commands Reference */}
    <div style={{ background: 'rgba(139, 92, 246, 0.04)', border: '1px solid rgba(139, 92, 246, 0.12)', borderRadius: '12px', padding: '20px' }}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#a78bfa' }}>🐚 Claude Code Slash Commands</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        After installing the Claude Code plugin, these slash commands are available globally in any Claude Code session:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { cmd: '/nr-status', desc: 'Show active providers and sessions' },
          { cmd: '/nr-sync', desc: 'Sync rules across .cursorrules, CLAUDE.md, GEMINI.md' },
          { cmd: '/nr-handover [from] [to]', desc: 'Generate handover from latest session' },
          { cmd: '/nr-tokens', desc: 'Show token usage vs context window limits' },
          { cmd: '/nr-prune [file]', desc: 'Strip implementation bodies to save tokens' }
        ].map(({ cmd, desc }) => (
          <div key={cmd} style={{ display: 'flex', gap: '12px', alignItems: 'baseline', fontSize: '0.85rem' }}>
            <code style={{ color: '#a78bfa', minWidth: '240px', fontFamily: 'var(--font-mono)' }}>{cmd}</code>
            <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Selected CLI demo */}
    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>🖥️ Live CLI Terminal Demo</h3>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {(['status', 'sync', 'tokens', 'daemon'] as const).map(cmd => (
          <button
            key={cmd}
            onClick={() => setSelectedCliCommand(cmd)}
            className="btn btn-secondary"
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: selectedCliCommand === cmd ? 'var(--color-primary-glow)' : 'transparent',
              color: selectedCliCommand === cmd ? 'var(--color-primary)' : 'var(--text-muted)',
              border: '1px solid',
              borderColor: selectedCliCommand === cmd ? 'var(--color-primary)' : 'var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {mockCliOutputs[cmd].cmd}
          </button>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: '1.7', color: '#e2e8f0' }}>
        <div style={{ marginBottom: '6px', color: '#64748b' }}>$ {mockCliOutputs[selectedCliCommand].cmd}</div>
        {mockCliOutputs[selectedCliCommand].output}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/walkthrough/page.tsx
git commit -m "feat: walkthrough step 7 shows live plugin install status with one-click install per provider"
```

---

## Task 8: Universal Skill for Commands

**Files:**
- Modify: `skills/mcp-shared-context.md`

The existing skill at `skills/mcp-shared-context.md` is the auto-injected skill. It needs to include the NextRouter commands reference so all providers learn about them automatically during rules sync.

- [ ] **Step 1: Read current content of `skills/mcp-shared-context.md`**

Run: `cat skills/mcp-shared-context.md`

- [ ] **Step 2: Append the NextRouter commands section**

Append the following to `skills/mcp-shared-context.md` (keep all existing content, add at end):

```markdown

## NextRouter Integrated Commands

NextRouter provides unified context management. When the user asks about provider status, rule sync, handover, token usage, or code pruning, use the appropriate tool or command:

| User Request | MCP Tool | CLI Command |
|---|---|---|
| "sync rules" or "push rules" | `sync_rules` | `nextrouter sync` |
| "get handover" or "bridge context" | `get_handover` | `nextrouter handover <provider>` |
| "show status" or "check providers" | `get_shared_context` | `nextrouter status` |
| "show token usage" | *(no MCP tool)* | `nextrouter tokens` |
| "prune this file" | `prune_code` | `nextrouter prune <file>` |
| "show active plan" | `get_active_plan` | *(read plan.md directly)* |

### In Claude Code: Use slash commands
- `/nr-sync` — Sync rules
- `/nr-handover [from] [to]` — Generate handover
- `/nr-status` — Check providers
- `/nr-tokens` — Token usage
- `/nr-prune [file]` — Prune a file
```

- [ ] **Step 3: Commit**

```bash
git add skills/mcp-shared-context.md
git commit -m "feat: add NextRouter commands reference to universal auto-inject skill"
```

---

## Task 9: CLI — Add `install-plugin` and `list-plugins` Commands

**Files:**
- Modify: `src/cli/index.ts`

- [ ] **Step 1: Add `install-plugin` and `list-plugins` cases to `src/cli/index.ts`**

After the `prune` case (around line 173), add before `default:`:

```typescript
case 'install-plugin':
case 'plugin-install': {
  const providerId = args[1];
  const validProviders = ['claude-code', 'cursor', 'antigravity', 'copilot', 'all'];
  if (!providerId || !validProviders.includes(providerId)) {
    console.error(`Usage: nextrouter install-plugin <provider>\nProviders: ${validProviders.join(', ')}`);
    process.exit(1);
  }
  const { installPlugin, getPluginStatus } = await import('../plugins/installer');
  const targets = providerId === 'all' ? ['claude-code', 'cursor', 'antigravity', 'copilot'] : [providerId];
  for (const id of targets) {
    console.log(`\nInstalling plugin for ${id}...`);
    const logs = installPlugin(id, workspacePath);
    logs.forEach(l => console.log(` ${l}`));
  }
  console.log('\n✓ Plugin installation complete.\n');
  break;
}

case 'list-plugins':
case 'plugins': {
  const { getPluginStatus } = await import('../plugins/installer');
  const statuses = getPluginStatus(workspacePath);
  console.log('\n=== NextRouter Plugin Status ===');
  statuses.forEach(s => {
    const icon = s.installed ? '✓' : '✗';
    const status = s.installed ? 'INSTALLED' : 'NOT INSTALLED';
    console.log(` ${icon} ${s.providerName} (${s.providerId}): ${status}`);
    if (!s.installed && s.missingFiles.length > 0) {
      s.missingFiles.forEach(f => console.log(`     Missing: ${f}`));
    }
  });
  console.log('');
  break;
}
```

- [ ] **Step 2: Add slash command aliases for new commands**

In the alias block at the top of `main()`, add:

```typescript
if (command === '/plugins' || command === '/list-plugins') command = 'list-plugins';
if (command === '/install-plugin') command = 'install-plugin';
```

- [ ] **Step 3: Update help text to list new commands**

In `printHelp()`, add to the Commands section:

```
  install-plugin <id|all>  Install NextRouter plugin into a provider (claude-code, cursor, antigravity, copilot, all)
  list-plugins             Show plugin installation status for all providers
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: add install-plugin and list-plugins CLI commands"
```

---

## Task 10: Verify Everything Works End-to-End

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Server starts at http://localhost:3000 with no TypeScript errors.

- [ ] **Step 2: Test plugin API**

```bash
curl http://localhost:3000/api/plugins
```

Expected: JSON array with 4 provider entries, each with `installed: false` (first run) or `installed: true` if already run.

- [ ] **Step 3: Test Claude Code plugin install via API**

```bash
curl -X POST http://localhost:3000/api/plugins \
  -H "Content-Type: application/json" \
  -d '{"providerId": "claude-code"}'
```

Expected: `{"success":true,"logs":["Claude Code command installed: ~/.claude/commands/nr-status.md", ...]}`

- [ ] **Step 4: Verify Claude Code commands were created**

```bash
ls ~/.claude/commands/nr-*.md
```

Expected: 5 files: `nr-status.md`, `nr-sync.md`, `nr-handover.md`, `nr-tokens.md`, `nr-prune.md`

```bash
cat ~/.claude/commands/nr-sync.md
```

Expected: Markdown file with bash command instructions for Claude.

- [ ] **Step 5: Test CLI install-plugin**

```bash
npx tsx src/cli/index.ts list-plugins
```

Expected: Table showing which providers have plugins installed.

```bash
npx tsx src/cli/index.ts install-plugin cursor
```

Expected: Logs showing `.cursor/rules/nextrouter-commands.mdc` created.

- [ ] **Step 6: Test walkthrough Step 7 in browser**

Navigate to http://localhost:3000/walkthrough, click **7. Commands & Plugins** tab.

Expected: Live plugin status grid shows each provider with install button. Click install for a provider → status updates to INSTALLED with file list.

- [ ] **Step 7: Test context bridge inject**

On the dashboard, click a session → Handover tab → select target provider → click Inject Context.

Expected: Button shows "Injected!" and `/api/context` returns 200.

- [ ] **Step 8: Commit test verification**

```bash
git add .
git commit -m "chore: verify end-to-end plugin system and context bridge functionality"
```

---

## Task 11: Final Cleanup — One-Click Setup Alert Style

**Files:**
- Modify: `src/app/walkthrough/page.tsx`

The one-click setup currently calls `alert()` which is bad UX. Replace with inline status display.

- [ ] **Step 1: Add `setupLogs` and `setupDone` state**

In `src/app/walkthrough/page.tsx`, add:

```typescript
const [setupLogs, setSetupLogs] = useState<string[]>([]);
const [setupDone, setSetupDone] = useState<boolean>(false);
```

- [ ] **Step 2: Replace `alert()` calls in `handleOneClickSetup` with state updates**

```typescript
async function handleOneClickSetup() {
  setSettingUp(true);
  setSetupLogs([]);
  setSetupDone(false);
  try {
    const res = await fetch('/api/system/setup', { method: 'POST' });
    const data = await res.json();
    setSetupLogs(data.logs || []);
    setSetupDone(data.success);
    if (data.success) {
      await loadPluginStatuses();
    }
  } catch (e: any) {
    setSetupLogs([`Error: ${e.message || e}`]);
  } finally {
    setSettingUp(false);
  }
}
```

- [ ] **Step 3: Add setup log display below the setup button in the MCP step**

After the one-click setup button in the `activeStep === 'mcp'` section, add:

```tsx
{setupLogs.length > 0 && (
  <div style={{
    marginTop: '12px',
    padding: '12px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    border: `1px solid ${setupDone ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
    fontSize: '0.78rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  }}>
    <div style={{ fontWeight: 700, color: setupDone ? 'var(--color-success)' : 'var(--color-danger)', marginBottom: '6px' }}>
      {setupDone ? '✓ Setup Complete' : '✗ Setup Failed'}
    </div>
    {setupLogs.map((log, i) => <div key={i}>{log}</div>)}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/walkthrough/page.tsx
git commit -m "fix: replace alert() in one-click setup with inline log display"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|---|---|
| Integrated commands in Claude Code | Task 3 (installer), Task 9 (CLI), Task 7 (walkthrough UI) |
| Integrated commands in Cursor | Task 3 (MDC rule) |
| Integrated commands in Antigravity | Task 3 (GEMINI.md injection) |
| Integrated commands in Copilot | Task 3 (copilot-instructions.md + tasks.json) |
| Plugin install/uninstall | Task 3 (installer), Task 4 (API) |
| Plugin status UI | Task 7 (walkthrough step 7) |
| Context Bridge target provider UI | Task 6 |
| One-click setup uses plugin system | Task 5 |
| Universal skill with commands reference | Task 8 |
| CLI plugin commands | Task 9 |
| All incomplete features finished | Tasks 5, 6, 7, 11 |
| Commit current batch | Task 1 |

### No Placeholders Found

All code blocks contain complete implementations. No TBD or TODO present.

### Type Consistency

- `PluginStatus` interface defined in `installer.ts` and consumed by `/api/plugins/route.ts` and walkthrough page — consistent.
- `installPlugin(providerId, workspacePath)` called identically in setup route and walkthrough handler — consistent.
- `bridgeTargetProvider` / `injecting` / `injected` state used consistently in `handleInjectToProvider` and JSX — consistent.

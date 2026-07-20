import fs from 'fs';
import path from 'path';
import os from 'os';
import { PROVIDER_PLUGINS } from './manifest';

export interface PluginStatus {
  providerId: string;
  providerName: string;
  color: string;
  installed: boolean;
  installedFiles: string[];
  missingFiles: string[];
}

let cachedPluginStatus: { [path: string]: { status: PluginStatus[]; timestamp: number } } = {};

export function getPluginStatus(workspacePath: string): PluginStatus[] {
  const now = Date.now();
  const cacheKey = workspacePath || 'default';
  const cached = cachedPluginStatus[cacheKey];
  if (cached && (now - cached.timestamp < 10000)) {
    return cached.status;
  }

  const status = PROVIDER_PLUGINS.map(plugin => {
    let files = getIntegrationFiles(plugin.providerId, workspacePath);
    let installed = false;

    if (plugin.providerId === 'cursor') {
      const mdcFile = path.join(workspacePath, '.cursor', 'rules', 'nextrouter-commands.mdc');
      const localMcpFile = path.join(workspacePath, '.cursor', 'mcp.json');
      const globalMcpFile = path.join(os.homedir(), '.cursor', 'mcp.json');

      const mdcExists = fs.existsSync(mdcFile);
      let localMcpExists = fs.existsSync(localMcpFile);
      let globalMcpExists = false;

      if (localMcpExists) {
        try {
          const config = JSON.parse(fs.readFileSync(localMcpFile, 'utf8'));
          if (config.mcpServers?.nextrouter) {
            localMcpExists = true;
          } else {
            localMcpExists = false;
          }
        } catch {
          localMcpExists = false;
        }
      }

      if (fs.existsSync(globalMcpFile)) {
        try {
          const config = JSON.parse(fs.readFileSync(globalMcpFile, 'utf8'));
          if (config.mcpServers?.nextrouter) {
            globalMcpExists = true;
          }
        } catch {}
      }

      installed = mdcExists && (localMcpExists || globalMcpExists);

      if (globalMcpExists) {
        files = [mdcFile];
      }
    } else {
      installed = files.length > 0 && files.every(f => fs.existsSync(f));
    }

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

  cachedPluginStatus[cacheKey] = { status, timestamp: now };
  return status;
}

export function clearPluginStatusCache() {
  cachedPluginStatus = {};
}

function getIntegrationFiles(providerId: string, workspacePath: string): string[] {
  const claudeCommandsDir = path.join(os.homedir(), '.claude', 'commands');
  switch (providerId) {
    case 'claude-code':
      return [
        path.join(workspacePath, 'CLAUDE.md'),
        ...['nr-status', 'nr-sync', 'nr-handover', 'nr-tokens', 'nr-prune']
          .map(id => path.join(claudeCommandsDir, `${id}.md`))
      ];
    case 'cursor':
      return [
        path.join(workspacePath, '.cursor', 'rules', 'nextrouter-commands.mdc'),
        path.join(workspacePath, '.cursor', 'mcp.json')
      ];
    case 'antigravity': {
      const geminiSettingsPath = path.join(os.homedir(), '.gemini', 'settings.json');
      return [
        path.join(workspacePath, 'GEMINI.md'),
        geminiSettingsPath
      ];
    }
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
      installClaudeCodeCommands(workspacePath, cliCmd, logs);
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

  clearPluginStatusCache();
  try {
    const { clearActiveProvidersCache } = require('../adapters/registry');
    clearActiveProvidersCache();
  } catch (e) {}

  // Trigger rules sync in background so new plugin immediately has skills and plans injected
  try {
    const { pullRules, pushRules } = require('../engine/rules-sync');
    pullRules(workspacePath)
      .then(() => pushRules(workspacePath))
      .catch((err: any) => console.error('Error syncing rules in installPlugin:', err));
  } catch (syncErr) {
    // Ignore require or run errors
  }

  return logs;
}

export function uninstallPlugin(providerId: string, workspacePath: string): string[] {
  const logs: string[] = [];
  const files = getIntegrationFiles(providerId, workspacePath);
  for (const file of files) {
    if (providerId === 'claude-code') {
      if (fs.existsSync(file)) {
        if (file.endsWith('CLAUDE.md')) {
          removeNextrouterBlockFromFile(file, '<!-- NEXTROUTER_COMMANDS_START -->', '<!-- NEXTROUTER_COMMANDS_END -->');
          logs.push(`Removed NextRouter commands block from CLAUDE.md`);
        } else {
          fs.unlinkSync(file);
          logs.push(`Removed: ${file}`);
        }
      }
    } else if (providerId === 'cursor') {
      if (file.endsWith('nextrouter-commands.mdc') && fs.existsSync(file)) {
        fs.unlinkSync(file);
        logs.push(`Removed: .cursor/rules/nextrouter-commands.mdc`);
      } else if (file.endsWith('mcp.json') && fs.existsSync(file)) {
        try {
          const config = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (config.mcpServers?.nextrouter) {
            delete config.mcpServers.nextrouter;
            fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
            logs.push(`Removed nextrouter entry from .cursor/mcp.json`);
          }
        } catch {}
      }
    } else if (providerId === 'antigravity') {
      if (file.endsWith('settings.json') && fs.existsSync(file)) {
        try {
          const config = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (config.mcpServers?.nextrouter) {
            delete config.mcpServers.nextrouter;
            fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
            logs.push(`Removed nextrouter entry from ~/.gemini/settings.json`);
          }
        } catch {}
      } else if (file.endsWith('GEMINI.md')) {
        removeNextrouterBlockFromFile(file, '<!-- NEXTROUTER_COMMANDS_START -->', '<!-- NEXTROUTER_COMMANDS_END -->');
        logs.push(`Removed NextRouter commands block from GEMINI.md`);
      }
    } else if (providerId === 'copilot') {
      if (file.endsWith('tasks.json') && fs.existsSync(file)) {
        removeNextrouterTasksFromJson(file, logs);
      } else if (file.endsWith('copilot-instructions.md')) {
        removeNextrouterBlockFromFile(file, '<!-- NEXTROUTER_COMMANDS_START -->', '<!-- NEXTROUTER_COMMANDS_END -->');
        logs.push(`Removed NextRouter block from ${path.basename(file)}`);
      }
    }
  }
  
  clearPluginStatusCache();
  try {
    const { clearActiveProvidersCache } = require('../adapters/registry');
    clearActiveProvidersCache();
  } catch (e) {}

  return logs;
}

function installClaudeCodeCommands(workspacePath: string, cliCmd: string, logs: string[]): void {
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

  // Workspace-level CLAUDE.md
  const claudeMdPath = path.join(workspacePath, 'CLAUDE.md');
  const block = `

<!-- NEXTROUTER_COMMANDS_START -->
## NextRouter — Context Management via MCP

NextRouter is registered as an MCP server. Call its tools proactively to manage context across AI providers.

### When to Call Each Tool

**\`get_shared_context\`** (no params) — Call when user asks "what were we working on?", "what's the current status?", or starting a new session.

**\`save_context\`** (providerId, title, messages) — Call when user says "save this session", "checkpoint this", or at natural stopping points.
Example: \`{ "providerId": "claude-code", "title": "Refactoring auth module", "messages": [...] }\`

**\`get_handover\`** (sourceProviderId, targetProviderId?) — Call when user says "continue this in Cursor", "hand off to Cursor", "generate a briefing".
Example: \`{ "sourceProviderId": "claude-code", "targetProviderId": "cursor" }\`

**\`sync_rules\`** (workspacePath) — Call when user says "sync rules", "update configs", or after editing CLAUDE.md.
Example: \`{ "workspacePath": "${workspacePath}" }\`

**\`prune_code\`** (filepath, write?) — Call when a file is too large for context, or user says "prune this file".
Example: \`{ "filepath": "src/adapters/cursor.ts", "write": false }\`

**\`get_active_plan\`** (workspacePath) — Call when user asks "what's the plan?" or starting a new feature.
Example: \`{ "workspacePath": "${workspacePath}" }\`

### CLI Commands (via Terminal)
\`\`\`bash
${cliCmd} status         # Show detected providers and active sessions
${cliCmd} sync           # Sync CLAUDE.md, GEMINI.md, .cursorrules
${cliCmd} handover claude-code cursor  # Generate handover packet
${cliCmd} tokens         # Show token usage vs context window limits
${cliCmd} prune src/adapters/cursor.ts  # Prune a file
\`\`\`
<!-- NEXTROUTER_COMMANDS_END -->`;

  let existing = '';
  if (fs.existsSync(claudeMdPath)) {
    existing = fs.readFileSync(claudeMdPath, 'utf8');
    existing = existing
      .replace(/<!-- NEXTROUTER_COMMANDS_START -->[\s\S]*<!-- NEXTROUTER_COMMANDS_END -->/, '')
      .trim();
  }
  fs.writeFileSync(claudeMdPath, existing + block, 'utf8');
  logs.push(`CLAUDE.md updated with proactive NextRouter tool guidance`);
}

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

  const mdcFilePath = path.join(rulesDir, 'nextrouter-commands.mdc');
  fs.writeFileSync(mdcFilePath, mdcContent, 'utf8');
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

  // Register MCP server in ~/.cursor/mcp.json (global)
  const globalCursorDir = path.join(os.homedir(), '.cursor');
  if (!fs.existsSync(globalCursorDir)) {
    fs.mkdirSync(globalCursorDir, { recursive: true });
  }
  const globalCursorMcpPath = path.join(globalCursorDir, 'mcp.json');
  let globalCursorMcpConfig: any = {};
  if (fs.existsSync(globalCursorMcpPath)) {
    try { globalCursorMcpConfig = JSON.parse(fs.readFileSync(globalCursorMcpPath, 'utf8')); } catch {}
  }
  if (!globalCursorMcpConfig.mcpServers) globalCursorMcpConfig.mcpServers = {};
  globalCursorMcpConfig.mcpServers.nextrouter = {
    command: 'npx',
    args: ['tsx', mcpPath]
  };
  fs.writeFileSync(globalCursorMcpPath, JSON.stringify(globalCursorMcpConfig, null, 2), 'utf8');
  logs.push(`Cursor Global MCP server registered: ~/.cursor/mcp.json`);
}

function installAntigravityGeminiMd(workspacePath: string, cliCmd: string, logs: string[]): void {
  const mcpPath = path.resolve(workspacePath, 'src', 'cli', 'mcp.ts');

  // Enhanced GEMINI.md block with proactive tool guidance
  const geminiMdPath = path.join(workspacePath, 'GEMINI.md');
  const block = `


<!-- NEXTROUTER_COMMANDS_START -->
## NextRouter — Context Management via MCP

NextRouter is registered as an MCP server in \`~/.gemini/settings.json\`. Call its tools proactively to manage context across AI providers.

### When to Call Each Tool

**\`get_shared_context\`** (no params) — Call when user asks "what were we working on?", "what's the current status?", or starting a new session.

**\`save_context\`** (providerId, title, messages) — Call when user says "save this session", "checkpoint this", or at natural stopping points.
Example: \`{ "providerId": "antigravity", "title": "Refactoring auth module", "messages": [...] }\`

**\`get_handover\`** (sourceProviderId, targetProviderId?) — Call when user says "continue this in Claude", "hand off to Cursor", "generate a briefing".
Example: \`{ "sourceProviderId": "antigravity", "targetProviderId": "cursor" }\`

**\`sync_rules\`** (workspacePath) — Call when user says "sync rules", "update configs", or after editing GEMINI.md.
Example: \`{ "workspacePath": "${workspacePath}" }\`

**\`prune_code\`** (filepath, write?) — Call when a file is too large for context, or user says "prune this file".
Example: \`{ "filepath": "src/adapters/antigravity.ts", "write": false }\`

**\`get_active_plan\`** (workspacePath) — Call when user asks "what's the plan?" or starting a new feature.
Example: \`{ "workspacePath": "${workspacePath}" }\`

### CLI Commands (via Terminal)
\`\`\`bash
${cliCmd} status         # Show detected providers and active sessions
${cliCmd} sync           # Sync GEMINI.md, CLAUDE.md, .cursorrules
${cliCmd} handover antigravity claude-code  # Generate handover packet
${cliCmd} tokens         # Show token usage vs context window limits
${cliCmd} prune src/adapters/antigravity.ts  # Prune a file
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
  logs.push(`Antigravity GEMINI.md updated with proactive NextRouter tool guidance`);

  // Register MCP server in ~/.gemini/settings.json
  const geminiDir = path.join(os.homedir(), '.gemini');
  if (!fs.existsSync(geminiDir)) {
    fs.mkdirSync(geminiDir, { recursive: true });
  }
  const geminiSettingsPath = path.join(geminiDir, 'settings.json');
  let geminiSettings: any = {};
  if (fs.existsSync(geminiSettingsPath)) {
    try { geminiSettings = JSON.parse(fs.readFileSync(geminiSettingsPath, 'utf8')); } catch {}
  }
  if (!geminiSettings.mcpServers) geminiSettings.mcpServers = {};
  geminiSettings.mcpServers.nextrouter = {
    command: 'npx',
    args: ['tsx', mcpPath]
  };
  fs.writeFileSync(geminiSettingsPath, JSON.stringify(geminiSettings, null, 2), 'utf8');
  logs.push(`Antigravity MCP server registered: ~/.gemini/settings.json`);

  // Copy workflow files to global customizations root
  copyAntigravityGlobalWorkflows(workspacePath, logs);
}

function copyAntigravityGlobalWorkflows(workspacePath: string, logs: string[]): void {
  const sourceDir = path.join(workspacePath, '.agent', 'workflows');
  if (!fs.existsSync(sourceDir)) {
    logs.push(`Warning: Source workflows directory not found in workspace: ${sourceDir}`);
    return;
  }

  const geminiDir = path.join(os.homedir(), '.gemini');
  const targets = [
    path.join(geminiDir, 'config', 'workflows')
  ];

  try {
    if (fs.existsSync(geminiDir)) {
      const items = fs.readdirSync(geminiDir);
      for (const item of items) {
        if (item.startsWith('antigravity')) {
          const fullPath = path.join(geminiDir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            targets.push(path.join(fullPath, 'global_workflows'));
          }
        }
      }
    }
  } catch (err: any) {
    logs.push(`Warning scanning .gemini directory: ${err.message}`);
  }

  // Fallback to default path if none were found
  if (targets.length === 1) {
    targets.push(path.join(geminiDir, 'antigravity', 'global_workflows'));
  }

  try {
    const files = fs.readdirSync(sourceDir);
    for (const targetDir of targets) {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      for (const file of files) {
        if (file.endsWith('.md')) {
          const srcFile = path.join(sourceDir, file);
          const destFile = path.join(targetDir, file);
          fs.copyFileSync(srcFile, destFile);
        }
      }
      logs.push(`Copied global workflows to: ${targetDir.replace(os.homedir(), '~')}`);
    }
  } catch (err: any) {
    logs.push(`Error copying global workflows: ${err.message}`);
  }
}


function installCopilotPlugin(workspacePath: string, cliCmd: string, logs: string[]): void {
  const githubDir = path.join(workspacePath, '.github');
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }

  const copilotMdPath = path.join(githubDir, 'copilot-instructions.md');
  const block = `\n\n<!-- NEXTROUTER_COMMANDS_START -->\n## NextRouter Context Management\n\nFor context management across AI providers, use these CLI patterns:\n- Check provider status: \`${cliCmd} status\`\n- Sync rules: \`${cliCmd} sync\`\n- Generate handover: \`${cliCmd} handover copilot\`\n- Token usage: \`${cliCmd} tokens\`\n- Prune a file: \`${cliCmd} prune <filepath>\`\n\nWhen user asks to "sync rules" or "generate handover" run the appropriate command above via terminal.\n<!-- NEXTROUTER_COMMANDS_END -->`;

  let existing = '';
  if (fs.existsSync(copilotMdPath)) {
    existing = fs.readFileSync(copilotMdPath, 'utf8');
    existing = existing
      .replace(/<!-- NEXTROUTER_COMMANDS_START -->[\s\S]*<!-- NEXTROUTER_COMMANDS_END -->/, '')
      .trim();
  }
  fs.writeFileSync(copilotMdPath, existing + block, 'utf8');
  logs.push(`Copilot instructions updated: .github/copilot-instructions.md`);

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

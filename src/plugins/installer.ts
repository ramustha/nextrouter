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

export function getPluginStatus(workspacePath: string): PluginStatus[] {
  return PROVIDER_PLUGINS.map(plugin => {
    const files = getIntegrationFiles(plugin.providerId, workspacePath);
    const installed = files.length > 0 && files.every(f => fs.existsSync(f));
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

function installAntigravityGeminiMd(workspacePath: string, cliCmd: string, logs: string[]): void {
  const geminiMdPath = path.join(workspacePath, 'GEMINI.md');
  const block = `\n\n<!-- NEXTROUTER_COMMANDS_START -->\n## NextRouter Integration\n\nNextRouter MCP server is connected. Use these tool calls for context management:\n- \`get_shared_context\` — Retrieve active cross-provider context\n- \`get_handover\` — Get handover packet from another provider's latest session\n- \`sync_rules\` — Sync workspace rules across all AI providers\n- \`prune_code\` — Strip implementation bodies to reduce token usage\n- \`get_active_plan\` — Read workspace plan.md\n\nCLI available at: \`${cliCmd}\`\n<!-- NEXTROUTER_COMMANDS_END -->`;

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

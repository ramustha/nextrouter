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
      path.join(process.cwd(), 'CLAUDE.md'),
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

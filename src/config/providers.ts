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

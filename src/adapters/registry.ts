import { ProviderAdapter } from './types';
import { ClaudeCodeAdapter } from './claude-code';
import { CursorAdapter } from './cursor';
import { AntigravityAdapter } from './antigravity';
import { CopilotAdapter } from './copilot';

export const adapters: ProviderAdapter[] = [
  new ClaudeCodeAdapter(),
  new CursorAdapter(),
  new AntigravityAdapter(),
  new CopilotAdapter()
];

export async function detectActiveProviders(workspacePath: string): Promise<ProviderAdapter[]> {
  const active: ProviderAdapter[] = [];
  for (const adapter of adapters) {
    try {
      if (await adapter.detect(workspacePath)) {
        active.push(adapter);
      }
    } catch (e) {
      console.error(`Error detecting provider ${adapter.id}:`, e);
    }
  }
  return active;
}

export function getAdapter(id: string): ProviderAdapter | undefined {
  return adapters.find(a => a.id === id);
}

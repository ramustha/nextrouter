import { ProviderAdapter, Session } from './types';
import { ClaudeCodeAdapter } from './claude-code';
import { CursorAdapter } from './cursor';
import { AntigravityAdapter } from './antigravity';
import { CopilotAdapter } from './copilot';

function wrapWithCache(adapter: ProviderAdapter): ProviderAdapter {
  const originalGetSessions = adapter.getSessions.bind(adapter);

  adapter.getSessions = async (workspacePath: string) => {
    const cacheKey = `${adapter.id}-${workspacePath || 'default'}`;
    const now = Date.now();
    
    // Store cache on globalThis to persist across Next.js dev reloads
    const globalCache = ((globalThis as any)._nextrouterSessionsCache) || new Map<string, { sessions: any[]; timestamp: number }>();
    (globalThis as any)._nextrouterSessionsCache = globalCache;

    const cached = globalCache.get(cacheKey);

    if (cached && (now - cached.timestamp < 15000)) {
      return cached.sessions;
    }

    const sessions = await originalGetSessions(workspacePath);
    globalCache.set(cacheKey, { sessions, timestamp: now });
    return sessions;
  };

  return adapter;
}

export const adapters: ProviderAdapter[] = [
  wrapWithCache(new ClaudeCodeAdapter()),
  wrapWithCache(new CursorAdapter()),
  wrapWithCache(new AntigravityAdapter()),
  wrapWithCache(new CopilotAdapter())
];

let cachedActiveProviders: { [path: string]: { providers: ProviderAdapter[]; timestamp: number } } = {};

export async function detectActiveProviders(workspacePath: string): Promise<ProviderAdapter[]> {
  const now = Date.now();
  const cacheKey = workspacePath || 'default';
  const cached = cachedActiveProviders[cacheKey];
  if (cached && (now - cached.timestamp < 15000)) {
    return cached.providers;
  }

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
  
  cachedActiveProviders[cacheKey] = { providers: active, timestamp: now };
  return active;
}

export function clearActiveProvidersCache() {
  cachedActiveProviders = {};
}

export function getAdapter(id: string): ProviderAdapter | undefined {
  return adapters.find(a => a.id === id);
}



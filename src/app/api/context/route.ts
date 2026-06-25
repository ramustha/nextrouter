import path from 'path';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';
import { detectActiveProviders } from '@/adapters/registry';
import { generateHandover } from '@/engine/handover';
import { triggerSystemNotification } from '@/notifications/alerts';
import { countTokens } from '@/engine/tokenizer';
import { getGitWorktrees } from '@/git/git-helper';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let workspacePath = searchParams.get('workspacePath') || '';
  if (!workspacePath || workspacePath === '/') {
    workspacePath = process.cwd();
  }

  const activeProviders = await detectActiveProviders(workspacePath);
  const metrics: Record<string, any> = {};
  let totalWorkspaceTokens = 0;

  for (const provider of activeProviders) {
    try {
      const size = await provider.getContextSize(workspacePath);
      metrics[provider.id] = size;
      totalWorkspaceTokens += size.totalTokens;

      if (size.budgetUsedPercent >= 90) {
        triggerSystemNotification(
          'NextRouter Alert',
          `${provider.name} context has crossed 90% threshold (${size.totalTokens.toLocaleString()} tokens). Consider switching providers.`,
          'Token Budget Limit Reached',
          `threshold-${provider.id}`
        );
      }
    } catch (e) {
      console.error(`Failed to get size for ${provider.id}:`, e);
    }
  }

  return NextResponse.json({
    totalWorkspaceTokens,
    providers: metrics
  });
}


export async function POST(request: Request) {
  const db = getDatabase();
  const body = await request.json();
  const { action, sourceProviderId, targetProviderId, sessionId, workspacePath, handoverType } = body;

  if (action === 'handover') {
    let sessions = db.sessions.all().filter(s => s.provider_id === sourceProviderId);
    if (workspacePath) {
      const worktrees = getGitWorktrees(workspacePath).map(p => path.resolve(p));
      sessions = sessions.filter(s => 
        s.workspace_path && 
        worktrees.includes(path.resolve(s.workspace_path))
      );
    }
    let session = sessions.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())[0];

    if (sessionId) {
      session = db.sessions.get(sessionId) || session;
    }

    if (!session) {
      return NextResponse.json({ error: 'No active session found' }, { status: 404 });
    }

    const normalizedSession = {
      id: session.id,
      title: session.title,
      startedAt: session.started_at,
      lastActiveAt: session.last_active_at,
      status: session.status as 'active' | 'archived',
      tokenCount: session.token_count,
      messages: session.messages,
      workspacePath: session.workspace_path
    };

    const packet = generateHandover(sourceProviderId, normalizedSession, targetProviderId, handoverType);
    return NextResponse.json(packet);
  }

  if (action === 'save') {
    const { providerId, title, messages } = body;
    if (!providerId || !title || !messages) {
      return NextResponse.json({ error: 'Missing required parameters for save' }, { status: 400 });
    }

    const newSessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    let tokenCount = 0;
    const parsedMessages = messages.map((m: any) => {
      const tokens = countTokens(m.content || '');
      tokenCount += tokens;
      return { 
        ...m, 
        tokens, 
        timestamp: now 
      };
    });

    db.sessions.upsert({
      id: newSessionId,
      provider_id: providerId,
      title,
      started_at: now,
      last_active_at: now,
      status: 'active',
      token_count: tokenCount,
      messages: parsedMessages,
      workspace_path: workspacePath || process.cwd()
    });

    // Track token usage
    db.tokenUsage.insert({
      provider_id: providerId,
      session_id: newSessionId,
      direction: 'input',
      tokens: tokenCount,
      cost: 0,
      timestamp: now
    });

    return NextResponse.json({ success: true, sessionId: newSessionId, tokenCount });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

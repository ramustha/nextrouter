import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';
import { detectActiveProviders } from '@/adapters/registry';
import { generateHandover } from '@/engine/handover';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspacePath = searchParams.get('workspacePath') || process.cwd();

  const activeProviders = await detectActiveProviders(workspacePath);
  const metrics: Record<string, any> = {};
  let totalWorkspaceTokens = 0;

  for (const provider of activeProviders) {
    try {
      const size = await provider.getContextSize(workspacePath);
      metrics[provider.id] = size;
      totalWorkspaceTokens += size.totalTokens;
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
  const { action, sourceProviderId, targetProviderId, sessionId } = body;

  if (action === 'handover') {
    const sessions = db.sessions.all().filter(s => s.provider_id === sourceProviderId);
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
      messages: session.messages
    };

    const packet = generateHandover(sourceProviderId, normalizedSession, targetProviderId);
    return NextResponse.json(packet);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';
import { detectActiveProviders } from '@/adapters/registry';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspacePath = searchParams.get('workspacePath') || process.cwd();
  
  const db = getDatabase();
  const activeProviders = await detectActiveProviders(workspacePath);

  // Sync sessions from active provider logs into DB
  for (const provider of activeProviders) {
    try {
      const sessions = await provider.getSessions(workspacePath);
      for (const s of sessions) {
        db.sessions.upsert({
          id: s.id,
          provider_id: provider.id,
          title: s.title,
          started_at: s.startedAt,
          last_active_at: s.lastActiveAt,
          status: s.status,
          token_count: s.tokenCount,
          messages: s.messages
        });
      }
    } catch (e) {
      console.error(`Failed to sync sessions for ${provider.id}:`, e);
    }
  }

  // Load unified timeline list from DB
  const list = db.sessions.all().sort(
    (a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
  );

  return NextResponse.json(list);
}

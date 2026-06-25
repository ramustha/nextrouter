import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';
import { detectActiveProviders, adapters } from '@/adapters/registry';
import { calculateSessionSavings } from '@/adapters/utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspacePath = searchParams.get('workspacePath') || process.cwd();
  
  const db = getDatabase();

  // Sync sessions from active provider logs into DB
  const sessionsToUpsert: any[] = [];
  for (const provider of adapters) {
    try {
      const sessions = await provider.getSessions(workspacePath);
      for (const s of sessions) {
        sessionsToUpsert.push({
          id: s.id,
          provider_id: provider.id,
          title: s.title,
          started_at: s.startedAt,
          last_active_at: s.lastActiveAt,
          status: s.status,
          token_count: s.tokenCount,
          messages: s.messages,
          workspace_path: s.workspacePath
        });
      }
    } catch (e) {
      console.error(`Failed to sync sessions for ${provider.id}:`, e);
    }
  }
  if (sessionsToUpsert.length > 0) {
    db.sessions.upsertMany(sessionsToUpsert);
  }

  // Load saved handover packets to check for actual briefings
  const handovers = db.handoverPackets.all();
  const handoverMap = new Map(handovers.map(h => [h.source_session_id, h]));

  // Load unified timeline list from DB
  const list = db.sessions.all().sort(
    (a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
  );

  const listWithSavings = list.map(session => {
    const handover = handoverMap.get(session.id);
    const savings = calculateSessionSavings(session, handover);
    return {
      ...session,
      savings
    };
  });

  return NextResponse.json(listWithSavings);
}


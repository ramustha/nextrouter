import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';
import { detectActiveProviders } from '@/adapters/registry';

export async function GET() {
  const db = getDatabase();
  const providers = db.providers.all();
  return NextResponse.json(providers);
}

export async function POST(request: Request) {
  const db = getDatabase();
  const body = await request.json();
  const workspacePath = body.workspacePath || process.cwd();

  const active = await detectActiveProviders(workspacePath);
  const activeIds = active.map(a => a.id);

  // Update status in DB
  const allProviders = db.providers.all();
  const now = new Date().toISOString();

  for (const p of allProviders) {
    const isActive = activeIds.includes(p.id);
    db.providers.upsert({
      ...p,
      status: isActive ? 'active' : 'inactive',
      workspace_path: workspacePath,
      last_scanned_at: now
    });
  }

  return NextResponse.json({
    success: true,
    scannedAt: now,
    activeProviders: activeIds
  });
}

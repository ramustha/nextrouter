import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';
import crypto from 'crypto';

export async function GET() {
  const db = getDatabase();
  const list = db.skills.all();
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const db = getDatabase();
  const body = await request.json();
  const { name, version, content, tags, autoInject } = body;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.skills.upsert({
    id,
    name,
    version: version || '1.0',
    content,
    tags: tags ? JSON.stringify(tags) : '[]',
    auto_inject: autoInject ? 1 : 0,
    last_updated_at: now
  });

  return NextResponse.json({ success: true, id });
}

export async function PUT(request: Request) {
  const db = getDatabase();
  const body = await request.json();
  const { id, name, version, content, tags, autoInject } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing skill ID' }, { status: 400 });
  }

  const now = new Date().toISOString();
  db.skills.upsert({
    id,
    name,
    version: version || '1.0',
    content,
    tags: tags ? JSON.stringify(tags) : '[]',
    auto_inject: autoInject ? 1 : 0,
    last_updated_at: now
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const db = getDatabase();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing skill ID' }, { status: 400 });
  }

  db.skills.delete(id);
  return NextResponse.json({ success: true });
}

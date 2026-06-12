import { NextRequest, NextResponse } from 'next/server';
import { getPluginStatus, installPlugin, uninstallPlugin } from '@/plugins/installer';

export async function GET(req: NextRequest) {
  const workspacePath = req.nextUrl.searchParams.get('workspacePath') || process.cwd();
  try {
    const status = getPluginStatus(workspacePath);
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { providerId, workspacePath = process.cwd() } = await req.json();
    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }
    const logs = installPlugin(providerId, workspacePath);
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { providerId, workspacePath = process.cwd() } = await req.json();
    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }
    const logs = uninstallPlugin(providerId, workspacePath);
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getGitStatus, getFileDiff } from '@/git/git-helper';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspacePath = searchParams.get('workspacePath') || process.cwd();
    const action = searchParams.get('action') || 'status';

    if (action === 'diff') {
      const file = searchParams.get('file');
      if (!file) {
        return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
      }
      const diff = getFileDiff(workspacePath, file);
      return NextResponse.json({ file, diff });
    }

    // Default: return status
    const status = getGitStatus(workspacePath);
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to query git status' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';
import { calculateSessionSavings, findPlanFiles, findSessionPlanFiles } from '@/adapters/utils';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getGitWorktrees } from '@/git/git-helper';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const workspacePath = searchParams.get('workspacePath') || process.cwd();

  if (action === 'readFile') {
    const filePath = searchParams.get('file');
    if (!filePath) {
      return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
    }
    
    let targetPath = path.resolve(filePath);
    if (!path.isAbsolute(filePath)) {
      targetPath = path.join(workspacePath, filePath);
    }
    
    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: `File not found at ${targetPath}` }, { status: 404 });
    }
    
    try {
      const stats = fs.statSync(targetPath);
      if (!stats.isFile()) {
        return NextResponse.json({ error: 'Path is not a file' }, { status: 400 });
      }
      const content = fs.readFileSync(targetPath, 'utf8');
      return NextResponse.json({ content });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Failed to read file' }, { status: 500 });
    }
  }

  const sessionId = searchParams.get('sessionId');
  const providerId = searchParams.get('providerId');

  if (!sessionId || !providerId) {
    return NextResponse.json({ error: 'Missing sessionId or providerId' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const session = db.sessions.get(sessionId);
    const sessionWorkspacePath = session?.workspace_path || workspacePath;

    // 1. References extraction (scan chat messages for file paths)
    const references: string[] = [];
    const fileRegex = /(?:file:\/\/\/|\b)([\w\-.\/]+\.(?:tsx?|jsx?|md|json|css|py|go|rs|c|cpp|h|html|sh|yml|yaml|sql|ps1))\b/g;

    if (session && session.messages) {
      for (const msg of session.messages) {
        let match;
        // Reset regex state since it's global
        fileRegex.lastIndex = 0;
        while ((match = fileRegex.exec(msg.content)) !== null) {
          const filePath = match[1];
          if (
            filePath &&
            !filePath.includes('node_modules') &&
            !filePath.startsWith('http') &&
            filePath.length > 2 &&
            !references.includes(filePath)
          ) {
            references.push(filePath);
          }
        }
      }
    }

    // 2. Session Plan & Spec files (detected per-session)
    const plansList: Array<{ name: string; path: string; content: string; mtime?: number }> = [];

    const detectedPlans = findSessionPlanFiles(session, sessionWorkspacePath);
    for (const dp of detectedPlans) {
      try {
        plansList.push({
          name: dp.name,
          path: dp.path,
          content: fs.readFileSync(dp.path, 'utf8'),
          mtime: dp.mtime
        });
      } catch (e) {
        // Ignore error
      }
    }

    // 3. Antigravity Brain Artifacts
    const localArtifacts: Array<{ name: string; path: string; size: number; content?: string }> = [];
    if (providerId === 'antigravity') {
      const brainSessionDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', sessionId);
      if (fs.existsSync(brainSessionDir)) {
        try {
          const files = fs.readdirSync(brainSessionDir);
          for (const f of files) {
            const fp = path.join(brainSessionDir, f);
            const stat = fs.statSync(fp);
            
            if (stat.isFile()) {
              if (f === '.DS_Store' || f.startsWith('.')) continue;
              let preview = '';
              if (f.endsWith('.md') || f.endsWith('.json') || f.endsWith('.txt')) {
                try {
                  preview = fs.readFileSync(fp, 'utf8');
                } catch (e) {}
              }
              localArtifacts.push({
                name: f,
                path: fp,
                size: stat.size,
                content: preview || undefined
              });
            } else if (stat.isDirectory() && f === 'scratch') {
              // Read scratch files inside brain/session/scratch/
              const scratchFiles = fs.readdirSync(fp);
              for (const sf of scratchFiles) {
                const sfp = path.join(fp, sf);
                const sfStat = fs.statSync(sfp);
                if (sfStat.isFile()) {
                  let sPreview = '';
                  if (
                    sf.endsWith('.js') ||
                    sf.endsWith('.ts') ||
                    sf.endsWith('.py') ||
                    sf.endsWith('.sh') ||
                    sf.endsWith('.txt')
                  ) {
                    try {
                      sPreview = fs.readFileSync(sfp, 'utf8');
                    } catch (e) {}
                  }
                  localArtifacts.push({
                    name: `scratch/${sf}`,
                    path: sfp,
                    size: sfStat.size,
                    content: sPreview || undefined
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error('Error scanning Antigravity session brain artifacts:', e);
        }
      }
    }

    // 4. Workspace Rules
    const rulesList: Array<{ name: string; path: string; content?: string }> = [];
    if (sessionWorkspacePath && fs.existsSync(sessionWorkspacePath)) {
      const ruleFiles = ['.cursorrules', 'CLAUDE.md', 'GEMINI.md'];
      for (const rf of ruleFiles) {
        const rp = path.join(sessionWorkspacePath, rf);
        if (fs.existsSync(rp)) {
          try {
            rulesList.push({
              name: rf,
              path: rp,
              content: fs.readFileSync(rp, 'utf8')
            });
          } catch (e) {}
        }
      }
    }

    // 5. Calculate Savings
    const handover = db.handoverPackets.all().find(h => h.source_session_id === sessionId);
    const savings = session ? calculateSessionSavings(session, handover) : null;

    return NextResponse.json({
      references,
      plans: plansList,
      artifacts: localArtifacts,
      rules: rulesList,
      savings
    });

  } catch (err: any) {
    console.error('Error fetching session details:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

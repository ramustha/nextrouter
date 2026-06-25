import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspacePath, providerId } = body;

    if (!workspacePath) {
      return NextResponse.json({ error: 'Missing workspacePath' }, { status: 400 });
    }

    const resolvedPath = path.resolve(workspacePath);
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: `Directory does not exist: ${resolvedPath}` }, { status: 404 });
    }

    const platform = os.platform();
    let command = '';

    if (providerId === 'folder') {
      if (platform === 'darwin') {
        command = `open "${resolvedPath}"`;
      } else if (platform === 'win32') {
        command = `explorer.exe "${resolvedPath}"`;
      } else {
        command = `xdg-open "${resolvedPath}"`;
      }
    } else if (providerId === 'cursor') {
      // Open in Cursor (fall back to VS Code if cursor command is not in path)
      if (platform === 'win32') {
        command = `cursor "${resolvedPath}"`;
      } else {
        command = `cursor "${resolvedPath}" || code "${resolvedPath}"`;
      }
    } else if (providerId === 'claude-code') {
      const escapedPath = resolvedPath.replace(/"/g, '\\"');
      if (platform === 'darwin') {
        // macOS AppleScript to spawn terminal, cd, and run claude
        command = `osascript -e 'tell application "Terminal" to do script "cd \\"${escapedPath}\\" && claude"' -e 'tell application "Terminal" to activate'`;
      } else if (platform === 'win32') {
        // Windows powershell to start a new powershell shell running claude
        command = `powershell -Command "Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd \\\"${escapedPath}\\\"; claude'"`;
      } else {
        // Linux: try gnome-terminal first
        command = `gnome-terminal --working-directory="${escapedPath}" -- claude || xterm -e "cd '${escapedPath}' && claude"`;
      }
    } else if (providerId === 'antigravity') {
      const escapedPath = resolvedPath.replace(/"/g, '\\"');
      if (platform === 'darwin') {
        command = `osascript -e 'tell application "Terminal" to do script "cd \\"${escapedPath}\\""' -e 'tell application "Terminal" to activate'`;
      } else if (platform === 'win32') {
        command = `powershell -Command "Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd \\\"${escapedPath}\\\"'"`;
      } else {
        command = `gnome-terminal --working-directory="${escapedPath}" || xterm -e "cd '${escapedPath}'"`;
      }
    } else {
      return NextResponse.json({ error: `Unsupported target provider: ${providerId}` }, { status: 400 });
    }

    return new Promise<NextResponse>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Launch failed: command="${command}"`, error);
          resolve(
            NextResponse.json(
              { error: `Launch command failed: ${stderr || error.message}` },
              { status: 500 }
            )
          );
        } else {
          resolve(NextResponse.json({ success: true, stdout }));
        }
      });
    });
  } catch (error: any) {
    console.error('Launch request error:', error);
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 });
  }
}

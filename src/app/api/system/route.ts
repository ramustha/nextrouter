import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { isWatcherActive } from '@/watcher/index';
import { 
  isDaemonRunning, 
  startDaemonBackground, 
  stopDaemon, 
  getActiveAIProcesses 
} from '@/cli/daemon';

export async function GET() {
  try {
    const home = os.homedir();
    
    // 1. Check Claude Code MCP configuration
    const claudeMcpPath = path.join(home, '.claude', 'mcp.json');
    let claudeConfigured = false;
    if (fs.existsSync(claudeMcpPath)) {
      try {
        const content = fs.readFileSync(claudeMcpPath, 'utf8');
        const mcpConfig = JSON.parse(content);
        claudeConfigured = !!(mcpConfig.mcpServers && mcpConfig.mcpServers.nextrouter);
      } catch (e) {}
    }

    // 2. Check Cursor MCP configuration
    const platform = os.platform();
    let cursorMcpPath = '';
    if (platform === 'darwin') {
      cursorMcpPath = path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'global-storage', 'mcp', 'config.json');
    } else if (platform === 'win32') {
      cursorMcpPath = path.join(process.env.APPDATA || '', 'Cursor', 'User', 'global-storage', 'mcp', 'config.json');
    } else {
      cursorMcpPath = path.join(home, '.config', 'Cursor', 'User', 'global-storage', 'mcp', 'config.json');
    }

    let cursorConfigured = false;
    if (fs.existsSync(cursorMcpPath)) {
      try {
        const content = fs.readFileSync(cursorMcpPath, 'utf8');
        const mcpConfig = JSON.parse(content);
        cursorConfigured = !!(mcpConfig.mcpServers && (mcpConfig.mcpServers.nextrouter || mcpConfig.mcpServers.NextRouter));
      } catch (e) {}
    }

    // 3. Get running daemon PID if active
    let daemonPid: number | null = null;
    const daemonRunning = isDaemonRunning();
    if (daemonRunning) {
      try {
        const pidStr = fs.readFileSync(path.join(process.cwd(), 'data', 'daemon.pid'), 'utf8').trim();
        daemonPid = parseInt(pidStr, 10);
      } catch (e) {}
    }

    const activeAI = getActiveAIProcesses();

    return NextResponse.json({
      workspacePath: process.cwd(),
      watcher: {
        running: isWatcherActive
      },
      daemon: {
        running: daemonRunning,
        pid: daemonPid,
        activeAIProcesses: activeAI
      },
      mcp: {
        configuredInClaude: claudeConfigured,
        configuredInCursor: cursorConfigured
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch system status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, service } = body;

    if (service === 'daemon') {
      if (action === 'start') {
        startDaemonBackground(process.cwd());
        return NextResponse.json({ success: true, message: 'Daemon start signal sent.' });
      } else if (action === 'stop') {
        stopDaemon();
        return NextResponse.json({ success: true, message: 'Daemon stop signal sent.' });
      }
    }

    return NextResponse.json({ error: 'Invalid service or action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Operation failed' },
      { status: 500 }
    );
  }
}

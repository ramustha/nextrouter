import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { 
  isDaemonRunning, 
  startDaemonBackground, 
  stopDaemon, 
  getActiveAIProcesses,
  isMcpServerRunning,
  startMcpServerBackground,
  stopMcpServer
} from '@/cli/daemon';

export async function GET() {
  try {
    const home = os.homedir();
    
    // 1. Check Claude Code MCP configuration (global ~/.claude.json or project-scoped configuration)
    const claudeMcpPath = path.join(home, '.claude.json');
    let claudeConfigured = false;
    if (fs.existsSync(claudeMcpPath)) {
      try {
        const content = fs.readFileSync(claudeMcpPath, 'utf8');
        const config = JSON.parse(content);
        const globalConfigured = !!(config.mcpServers && config.mcpServers.nextrouter);
        const projectConfigured = !!(config.projects && config.projects[process.cwd()] && config.projects[process.cwd()].mcpServers && config.projects[process.cwd()].mcpServers.nextrouter);
        claudeConfigured = globalConfigured || projectConfigured;
      } catch (e) {}
    }

    // 2. Check Cursor MCP configuration (global storage or project-scoped .cursor/mcp.json)
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

    if (!cursorConfigured) {
      const localMcpPath = path.join(process.cwd(), '.cursor', 'mcp.json');
      if (fs.existsSync(localMcpPath)) {
        try {
          const content = fs.readFileSync(localMcpPath, 'utf8');
          const mcpConfig = JSON.parse(content);
          cursorConfigured = !!(mcpConfig.mcpServers && (mcpConfig.mcpServers.nextrouter || mcpConfig.mcpServers.NextRouter));
        } catch (e) {}
      }
    }

    // 3. Get running daemon PID if active
    let daemonPid: number | null = null;
    let daemonHealth: any = null;
    const daemonRunning = isDaemonRunning();
    if (daemonRunning) {
      try {
        const pidStr = fs.readFileSync(path.join(process.cwd(), 'data', 'daemon.pid'), 'utf8').trim();
        daemonPid = parseInt(pidStr, 10);
        
        const healthPath = path.join(process.cwd(), 'data', 'daemon-health.json');
        if (fs.existsSync(healthPath)) {
          daemonHealth = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
        }
      } catch (e) {}
    }

    const activeAI = getActiveAIProcesses();

    const mcpServerRunning = isMcpServerRunning();
    let mcpServerPid: number | null = null;
    if (mcpServerRunning) {
      try {
        const pidStr = fs.readFileSync(path.join(process.cwd(), 'data', 'mcp.pid'), 'utf8').trim();
        mcpServerPid = parseInt(pidStr, 10);
      } catch (e) {}
    }

    return NextResponse.json({
      workspacePath: process.cwd(),
      watcher: {
        running: daemonRunning
      },
      daemon: {
        running: daemonRunning,
        pid: daemonPid,
        activeAIProcesses: activeAI,
        health: daemonHealth
      },
      mcp: {
        configuredInClaude: claudeConfigured,
        configuredInCursor: cursorConfigured,
        server: {
          running: mcpServerRunning,
          pid: mcpServerPid,
          port: 3001
        }
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
    } else if (service === 'mcp-server') {
      if (action === 'start') {
        startMcpServerBackground(process.cwd());
        return NextResponse.json({ success: true, message: 'MCP SSE Server start signal sent.' });
      } else if (action === 'stop') {
        stopMcpServer();
        return NextResponse.json({ success: true, message: 'MCP SSE Server stop signal sent.' });
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

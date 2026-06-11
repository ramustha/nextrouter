import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pullRules, pushRules } from '@/engine/rules-sync';
import { isDaemonRunning, startDaemonBackground } from '@/cli/daemon';

const execAsync = promisify(exec);

export async function POST() {
  const logs: string[] = [];
  try {
    const projectRoot = process.cwd();
    const home = os.homedir();
    const mcpPath = path.resolve(projectRoot, 'src', 'cli', 'mcp.ts');
    const cliPath = path.resolve(projectRoot, 'src', 'cli', 'index.ts');

    // 1. Cursor MCP Setup
    try {
      const cursorMcpDir = path.join(home, '.cursor');
      const cursorMcpPath = path.join(cursorMcpDir, 'mcp.json');
      
      if (!fs.existsSync(cursorMcpDir)) {
        fs.mkdirSync(cursorMcpDir, { recursive: true });
      }

      let mcpConfig: any = { mcpServers: {} };
      if (fs.existsSync(cursorMcpPath)) {
        try {
          const content = fs.readFileSync(cursorMcpPath, 'utf8');
          mcpConfig = JSON.parse(content);
        } catch (parseErr) {
          logs.push(`Warning: Failed to parse existing Cursor mcp.json, overwriting.`);
        }
      }

      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
      mcpConfig.mcpServers.nextrouter = {
        command: 'npx',
        args: ['tsx', mcpPath]
      };

      fs.writeFileSync(cursorMcpPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
      logs.push(`Cursor MCP successfully configured at ~/.cursor/mcp.json`);
    } catch (cursorErr: any) {
      logs.push(`Error configuring Cursor MCP: ${cursorErr.message}`);
    }

    // 2. Antigravity MCP Setup
    try {
      const antigravityMcpDir = path.join(home, '.gemini', 'antigravity');
      const antigravityMcpPath = path.join(antigravityMcpDir, 'mcp_config.json');
      
      if (!fs.existsSync(antigravityMcpDir)) {
        fs.mkdirSync(antigravityMcpDir, { recursive: true });
      }

      let mcpConfig: any = { mcpServers: {} };
      if (fs.existsSync(antigravityMcpPath)) {
        try {
          const content = fs.readFileSync(antigravityMcpPath, 'utf8');
          mcpConfig = JSON.parse(content);
        } catch (parseErr) {
          logs.push(`Warning: Failed to parse existing Antigravity mcp_config.json, overwriting.`);
        }
      }

      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
      mcpConfig.mcpServers.nextrouter = {
        command: 'npx',
        args: ['tsx', mcpPath]
      };

      fs.writeFileSync(antigravityMcpPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
      logs.push(`Antigravity MCP successfully configured at ~/.gemini/antigravity/mcp_config.json`);
    } catch (antigravityErr: any) {
      logs.push(`Error configuring Antigravity MCP: ${antigravityErr.message}`);
    }

    // 3. Claude Code MCP Setup
    try {
      // Find where claude is, default to global 'claude'
      const { stdout, stderr } = await execAsync(`claude mcp add nextrouter npx tsx ${mcpPath}`, { cwd: projectRoot });
      logs.push(`Claude Code MCP successfully registered via CLI: ${stdout.trim()}`);
    } catch (claudeErr: any) {
      logs.push(`Warning: Claude Code MCP registration via CLI skipped/failed (ensure Claude is configured locally). Error: ${claudeErr.message}`);
      
      // Fallback: Try editing project specific settings inside ~/.claude.json if it exists
      try {
        const claudeJsonPath = path.join(home, '.claude.json');
        if (fs.existsSync(claudeJsonPath)) {
          const content = fs.readFileSync(claudeJsonPath, 'utf8');
          const config = JSON.parse(content);
          if (config.projects && config.projects[projectRoot]) {
            if (!config.projects[projectRoot].mcpServers) {
              config.projects[projectRoot].mcpServers = {};
            }
            config.projects[projectRoot].mcpServers.nextrouter = {
              type: 'stdio',
              command: 'npx',
              args: ['tsx', mcpPath],
              env: {}
            };
            fs.writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2), 'utf8');
            logs.push(`Claude Code project-scoped MCP successfully fallback-written to ~/.claude.json`);
          }
        }
      } catch (fallbackErr: any) {
        logs.push(`Failed Claude Code fallback write: ${fallbackErr.message}`);
      }
    }

    // 4. Shell Alias setup
    try {
      const aliasLine = `\n# NextRouter CLI Alias\nalias nextrouter="npx tsx ${cliPath}"\n`;
      const zshrcPath = path.join(home, '.zshrc');
      const bashrcPath = path.join(home, '.bashrc');

      let configuredShells = 0;
      if (fs.existsSync(zshrcPath)) {
        const content = fs.readFileSync(zshrcPath, 'utf8');
        if (!content.includes('alias nextrouter=')) {
          fs.appendFileSync(zshrcPath, aliasLine, 'utf8');
          configuredShells++;
        }
      }
      if (fs.existsSync(bashrcPath)) {
        const content = fs.readFileSync(bashrcPath, 'utf8');
        if (!content.includes('alias nextrouter=')) {
          fs.appendFileSync(bashrcPath, aliasLine, 'utf8');
          configuredShells++;
        }
      }
      
      if (configuredShells > 0) {
        logs.push(`Shell alias 'nextrouter' added to shell profile configs`);
      } else {
        logs.push(`Shell alias 'nextrouter' already exists or profiles not found`);
      }
    } catch (shellErr: any) {
      logs.push(`Error configuring shell alias: ${shellErr.message}`);
    }

    // 5. Rules & Skills Sync
    try {
      await pullRules(projectRoot);
      await pushRules(projectRoot);
      logs.push(`Universal prompt skills and rules successfully synchronized across all active providers`);
    } catch (syncErr: any) {
      logs.push(`Error synchronizing rules: ${syncErr.message}`);
    }

    // 6. Watcher Daemon Start
    try {
      if (!isDaemonRunning()) {
        startDaemonBackground(projectRoot);
        logs.push(`Background file sync daemon worker launched`);
      } else {
        logs.push(`Background file sync daemon worker is already active`);
      }
    } catch (daemonErr: any) {
      logs.push(`Error starting daemon: ${daemonErr.message}`);
    }

    return NextResponse.json({
      success: true,
      logs
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown system configuration failure',
      logs
    }, { status: 500 });
  }
}

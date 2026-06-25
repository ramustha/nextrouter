import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pullRules, pushRules } from '@/engine/rules-sync';
import { isDaemonRunning, startDaemonBackground } from '@/cli/daemon';
import { installPlugin } from '@/plugins/installer';

const execAsync = promisify(exec);

export async function POST() {
  const logs: string[] = [];
  try {
    const projectRoot = process.cwd();
    const home = os.homedir();
    const cliPath = path.resolve(projectRoot, 'src', 'cli', 'index.ts');

    // 1. Install provider plugins (commands + integration files)
    for (const providerId of ['claude-code', 'cursor', 'antigravity', 'copilot']) {
      try {
        const pluginLogs = installPlugin(providerId, projectRoot);
        logs.push(...pluginLogs);
      } catch (pluginErr: any) {
        logs.push(`Warning: Plugin install failed for ${providerId}: ${pluginErr.message}`);
      }
    }

    // 2. Claude Code MCP registration via CLI
    try {
      const mcpPath = path.resolve(projectRoot, 'src', 'cli', 'mcp.ts');
      const { stdout } = await execAsync(`claude mcp add nextrouter npx tsx ${mcpPath}`, { cwd: projectRoot });
      logs.push(`Claude Code MCP registered via CLI: ${stdout.trim()}`);
    } catch (claudeErr: any) {
      try {
        const claudeJsonPath = path.join(home, '.claude.json');
        if (fs.existsSync(claudeJsonPath)) {
          const mcpPath = path.resolve(projectRoot, 'src', 'cli', 'mcp.ts');
          const config = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
          if (config.projects?.[projectRoot]) {
            if (!config.projects[projectRoot].mcpServers) config.projects[projectRoot].mcpServers = {};
            config.projects[projectRoot].mcpServers.nextrouter = {
              type: 'stdio',
              command: 'npx',
              args: ['tsx', mcpPath],
              env: {}
            };
            fs.writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2), 'utf8');
            logs.push(`Claude Code MCP fallback-written to ~/.claude.json`);
          }
        }
      } catch (fbErr: any) {
        logs.push(`Warning: Claude MCP config skipped: ${claudeErr.message}`);
      }
    }

    // 3. Shell alias setup
    if (os.platform() !== 'win32') {
      try {
        const aliasLine = `\n# NextRouter CLI Alias\nalias nextrouter="npx tsx ${cliPath}"\n`;
        for (const rcFile of [path.join(home, '.zshrc'), path.join(home, '.bashrc')]) {
          if (fs.existsSync(rcFile)) {
            const content = fs.readFileSync(rcFile, 'utf8');
            if (!content.includes('alias nextrouter=')) {
              fs.appendFileSync(rcFile, aliasLine, 'utf8');
              logs.push(`Shell alias added to ${path.basename(rcFile)}`);
            } else {
              logs.push(`Shell alias already present in ${path.basename(rcFile)}`);
            }
          }
        }
      } catch (shellErr: any) {
        logs.push(`Error configuring shell alias: ${shellErr.message}`);
      }
    } else {
      logs.push(`Windows detected: To set up a CLI alias, add this to your $PROFILE: Function nextrouter { npx tsx "${cliPath}" $args }`);
    }

    // 4. Rules & Skills Sync
    try {
      await pullRules(projectRoot);
      await pushRules(projectRoot);
      logs.push(`Rules and skills synchronized across all providers`);
    } catch (syncErr: any) {
      logs.push(`Error synchronizing rules: ${syncErr.message}`);
    }

    // 5. Watcher Daemon
    try {
      if (!isDaemonRunning()) {
        startDaemonBackground(projectRoot);
        logs.push(`Background sync daemon launched`);
      } else {
        logs.push(`Background sync daemon already running`);
      }
    } catch (daemonErr: any) {
      logs.push(`Error starting daemon: ${daemonErr.message}`);
    }

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown setup failure',
      logs
    }, { status: 500 });
  }
}

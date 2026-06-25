import path from 'path';
import fs from 'fs';
import { getDatabase } from '../store/database';
import { detectActiveProviders, adapters } from '../adapters/registry';
import { pullRules, pushRules } from '../engine/rules-sync';
import { generateHandover } from '../engine/handover';
import { getBudgetAnalysis } from '../engine/tokenizer';
import { getGitWorktrees } from '../git/git-helper';

async function syncSessionsIntoDB(workspacePath: string, db: any) {
  const sessionsToUpsert: any[] = [];
  for (const provider of adapters) {
    try {
      const providerSessions = await provider.getSessions(workspacePath);
      for (const s of providerSessions) {
        sessionsToUpsert.push({
          id: s.id,
          provider_id: provider.id,
          title: s.title,
          started_at: s.startedAt,
          last_active_at: s.lastActiveAt,
          status: s.status,
          token_count: s.tokenCount,
          messages: s.messages,
          workspace_path: s.workspacePath
        });
      }
    } catch (e) {
      // Ignore silently
    }
  }
  if (sessionsToUpsert.length > 0) {
    db.sessions.upsertMany(sessionsToUpsert);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let command = args[0];

  // Resolve Slash Command and alternate aliases
  if (command === '/sync') command = 'sync';
  if (command === '/handover' || command === '/handoff' || command === 'handoff') command = 'handover';
  if (command === '/tokens') command = 'tokens';
  if (command === '/daemon') command = 'daemon';
  if (command === '/status') command = 'status';
  if (command === '/prune') command = 'prune';
  if (command === '/help') command = 'help';
  if (command === '/plugins' || command === '/list-plugins') command = 'list-plugins';
  if (command === '/install-plugin') command = 'install-plugin';
  if (command === '/setup' || command === 'setup') command = 'setup';

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const db = getDatabase();
  const workspacePath = process.cwd();

  try {
    switch (command) {
      case 'status': {
        console.log('\n=== NextRouter CLI Status ===');
        console.log(`Workspace Path: ${workspacePath}`);
        
        await syncSessionsIntoDB(workspacePath, db);
        
        const active = await detectActiveProviders(workspacePath);
        console.log(`\nActive Providers Detected (${active.length}):`);
        active.forEach(a => console.log(` - ${a.name} (${a.id})`));

        const sessions = db.sessions.all().filter(s => s.status === 'active');
        console.log(`\nActive Sessions in DB (${sessions.length}):`);
        sessions.slice(0, 5).forEach(s => {
          console.log(` - [${s.provider_id}] "${s.title}" (${s.token_count} tokens)`);
        });
        console.log('');
        break;
      }

      case 'sync': {
        console.log('\nInitiating bidirectional rule sync...');
        await pullRules(workspacePath);
        await pushRules(workspacePath);
        console.log('Rules synced successfully across all active providers!\n');
        break;
      }

      case 'handover': {
        const originalIdx = args.findIndex(arg => arg === '--original' || arg === '--raw' || arg === '-r');
        const handoverType = originalIdx >= 0 ? 'original' : 'briefing';

        const positionalArgs: string[] = [];
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg.startsWith('-')) {
            if (arg === '--out' || arg === '-o') {
              i++; // Skip its value
            }
            continue;
          }
          positionalArgs.push(arg);
        }

        const fromProvider = positionalArgs[0];
        const toProvider = positionalArgs[1];
        
        let outPath = '';
        const outIdx = args.findIndex(arg => arg === '--out' || arg === '-o');
        if (outIdx >= 0 && args[outIdx + 1]) {
          outPath = args[outIdx + 1];
        }

        if (!fromProvider) {
          console.error('Error: Missing source provider ID. Usage: nextrouter handover <from-provider> [to-provider] [--out <dir-or-file>] [--original]');
          process.exit(1);
        }

        await syncSessionsIntoDB(workspacePath, db);

        const worktrees = getGitWorktrees(workspacePath).map(p => path.resolve(p));
        const sessions = db.sessions.all().filter(s => 
          s.provider_id === fromProvider && 
          s.workspace_path && 
          worktrees.includes(path.resolve(s.workspace_path))
        );
        const latest = sessions.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())[0];

        if (!latest) {
          console.error(`Error: No active sessions found in database for provider: ${fromProvider} in workspace: ${workspacePath}`);
          process.exit(1);
        }

        console.log(`\nCompiling handover context (${handoverType}) from session: "${latest.title}"...`);
        const packet = generateHandover(fromProvider, {
          id: latest.id,
          title: latest.title,
          startedAt: latest.started_at,
          lastActiveAt: latest.last_active_at,
          status: latest.status as any,
          tokenCount: latest.token_count,
          messages: latest.messages,
          workspacePath: latest.workspace_path
        }, toProvider, handoverType);

        if (outPath) {
          let targetFile = path.resolve(outPath);
          try {
            const stats = fs.statSync(targetFile);
            if (stats.isDirectory()) {
              targetFile = path.join(targetFile, 'handover.md');
            }
          } catch (e) {
            // Assume it's a file path unless it ends with a slash
            if (outPath.endsWith('/') || outPath.endsWith('\\')) {
              fs.mkdirSync(targetFile, { recursive: true });
              targetFile = path.join(targetFile, 'handover.md');
            } else {
              // Ensure parent directory exists
              const parentDir = path.dirname(targetFile);
              if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
              }
            }
          }
          
          fs.writeFileSync(targetFile, packet.rawMarkdown, 'utf8');
          console.log(`✓ Handover packet successfully written to: ${targetFile}\n`);
        } else {
          console.log('\n----------------------------------------');
          console.log(packet.rawMarkdown);
          console.log('----------------------------------------\n');
        }
        break;
      }

      case 'tokens': {
        console.log('\n=== Shared Token Pool & Model Budgets ===');
        await syncSessionsIntoDB(workspacePath, db);

        const sessions = db.sessions.all().filter(s => s.status === 'active');
        const totalUsed = sessions.reduce((sum, s) => sum + s.token_count, 0);

        console.log(`Total Active Tokens: ${totalUsed.toLocaleString()}`);
        
        const analysis = getBudgetAnalysis(totalUsed);
        console.log('\nUsage vs Model Context Windows:');
        analysis.forEach(a => {
          const status = a.isOverLimit ? '🔴 OVER LIMIT' : '🟢 SAFE';
          console.log(` - [${status}] ${a.modelName}: ${a.percent}% used (${a.used.toLocaleString()} / ${a.limit.toLocaleString()})`);
        });
        console.log('');
        break;
      }

      case 'daemon': {
        const daemonAction = args[1];
        const { startDaemonBackground, stopDaemon, getDaemonStatus, runDaemonWorker } = await import('./daemon');

        if (daemonAction === 'start') {
          startDaemonBackground(workspacePath);
        } else if (daemonAction === 'stop') {
          stopDaemon();
        } else if (daemonAction === 'status') {
          getDaemonStatus();
        } else if (daemonAction === 'run-worker') {
          await runDaemonWorker(workspacePath);
        } else {
          console.log('\nUsage: npm run cli daemon [start|stop|status]\n');
        }
        break;
      }

      case 'prune': {
        const filepath = args[1];
        const writeFlag = args[2] === '--write' || args[2] === '-w';

        if (!filepath) {
          console.error('Error: Missing filepath. Usage: nextrouter prune <filepath> [--write]');
          process.exit(1);
        }

        const fs = await import('fs');
        const path = await import('path');
        const { compressCode } = await import('../engine/compressor');
        const { countTokens } = await import('../engine/tokenizer');

        const absolutePath = path.resolve(filepath);
        if (!fs.existsSync(absolutePath)) {
          console.error(`Error: File does not exist at path: ${absolutePath}`);
          process.exit(1);
        }

        const stats = fs.statSync(absolutePath);
        if (stats.isDirectory()) {
          console.error(`Error: Path is a directory: ${absolutePath}`);
          process.exit(1);
        }

        const content = fs.readFileSync(absolutePath, 'utf8');
        const filename = path.basename(absolutePath);
        const originalTokens = countTokens(content);

        const prunedContent = compressCode(filename, content);
        const prunedTokens = countTokens(prunedContent);
        const savedPercent = originalTokens > 0 
          ? Math.round(((originalTokens - prunedTokens) / originalTokens) * 100) 
          : 0;

        console.log('\n--- Pruned Output Code ---');
        console.log(prunedContent);
        console.log('--------------------------');
        console.log(`\nOriginal Tokens: ${originalTokens.toLocaleString()}`);
        console.log(`Pruned Tokens:   ${prunedTokens.toLocaleString()}`);
        console.log(`Token Savings:   ${savedPercent}% saved (${(originalTokens - prunedTokens).toLocaleString()} tokens)`);

        if (writeFlag) {
          fs.writeFileSync(absolutePath, prunedContent, 'utf8');
          console.log(`\n✓ Successfully overwrote and updated file in place: ${filepath}`);
        }
        console.log('');
        break;
      }

      case 'install-plugin':
      case 'plugin-install': {
        const providerId = args[1];
        const validProviders = ['claude-code', 'cursor', 'antigravity', 'copilot', 'all'];
        if (!providerId || !validProviders.includes(providerId)) {
          console.error(`Usage: nextrouter install-plugin <provider>\nProviders: ${validProviders.join(', ')}`);
          process.exit(1);
        }
        const { installPlugin, getPluginStatus } = await import('../plugins/installer');
        const targets = providerId === 'all' ? ['claude-code', 'cursor', 'antigravity', 'copilot'] : [providerId];
        for (const id of targets) {
          console.log(`\nInstalling plugin for ${id}...`);
          const logs = installPlugin(id, workspacePath);
          logs.forEach(l => console.log(` ${l}`));
        }
        console.log('\n✓ Plugin installation complete.\n');
        break;
      }

      case 'list-plugins':
      case 'plugins': {
        const { getPluginStatus } = await import('../plugins/installer');
        const statuses = getPluginStatus(workspacePath);
        console.log('\n=== NextRouter Plugin Status ===');
        statuses.forEach(s => {
          const icon = s.installed ? '✓' : '✗';
          const status = s.installed ? 'INSTALLED' : 'NOT INSTALLED';
          console.log(` ${icon} ${s.providerName} (${s.providerId}): ${status}`);
          if (!s.installed && s.missingFiles.length > 0) {
            s.missingFiles.forEach(f => console.log(`     Missing: ${f}`));
          }
        });
        console.log('');
        break;
      }

      case 'setup': {
        console.log('\n=== NextRouter One-Click Laptop Setup ===');
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const os = await import('os');
        const { installPlugin } = await import('../plugins/installer');
        const { isDaemonRunning, startDaemonBackground } = await import('./daemon');
        const { pullRules, pushRules } = await import('../engine/rules-sync');

        // 1. Windows SQLite dependency setup if needed
        if (os.platform() === 'win32') {
          const binDir = path.join(workspacePath, 'bin');
          const sqlitePath = path.join(binDir, 'sqlite3.exe');
          if (!fs.existsSync(sqlitePath)) {
            console.log('Windows platform detected & local SQLite binary missing. Running setup-windows.ps1...');
            try {
              const scriptPath = path.join(workspacePath, 'setup-windows.ps1');
              await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, { cwd: workspacePath });
              console.log('✓ Local SQLite binary setup successfully!');
            } catch (err: any) {
              console.warn(`Warning: Failed to run Windows SQLite auto-downloader: ${err.message}`);
              console.warn('Please run "npm run setup:windows" manually.');
            }
          }
        }

        // 2. Install plugins for all active editors
        console.log('Installing plugins and rule configurations...');
        for (const providerId of ['claude-code', 'cursor', 'antigravity', 'copilot']) {
          try {
            const logs = installPlugin(providerId, workspacePath);
            logs.forEach(l => console.log(` - ${l}`));
          } catch (e: any) {
            console.error(` - Warning: Setup failed for ${providerId}: ${e.message}`);
          }
        }

        // 3. Register Claude Code MCP server
        console.log('Registering NextRouter MCP Server in Claude Code...');
        try {
          const mcpPath = path.resolve(workspacePath, 'src', 'cli', 'mcp.ts');
          const { stdout } = await execAsync(`claude mcp add nextrouter npx tsx ${mcpPath}`, { cwd: workspacePath });
          console.log(` - Claude Code MCP registered: ${stdout.trim()}`);
        } catch (claudeErr: any) {
          try {
            const home = os.homedir();
            const claudeJsonPath = path.join(home, '.claude.json');
            if (fs.existsSync(claudeJsonPath)) {
              const mcpPath = path.resolve(workspacePath, 'src', 'cli', 'mcp.ts');
              const config = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
              if (config.projects?.[workspacePath]) {
                if (!config.projects[workspacePath].mcpServers) config.projects[workspacePath].mcpServers = {};
                config.projects[workspacePath].mcpServers.nextrouter = {
                  type: 'stdio',
                  command: 'npx',
                  args: ['tsx', mcpPath],
                  env: {}
                };
                fs.writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2), 'utf8');
                console.log(` - Claude Code MCP fallback-written to ~/.claude.json`);
              }
            }
          } catch (fbErr: any) {
            console.log(` - Warning: Claude MCP config skipped: ${claudeErr.message}`);
          }
        }

        // 4. Register MCP in shell
        if (os.platform() !== 'win32') {
          console.log('Setting up NextRouter shell CLI alias...');
          try {
            const home = os.homedir();
            const cliPath = path.resolve(workspacePath, 'src', 'cli', 'index.ts');
            const aliasLine = `\n# NextRouter CLI Alias\nalias nextrouter="npx tsx ${cliPath}"\n`;
            for (const rcFile of [path.join(home, '.zshrc'), path.join(home, '.bashrc')]) {
              if (fs.existsSync(rcFile)) {
                const content = fs.readFileSync(rcFile, 'utf8');
                if (!content.includes('alias nextrouter=')) {
                  fs.appendFileSync(rcFile, aliasLine, 'utf8');
                  console.log(` - Shell alias added to ${path.basename(rcFile)}`);
                } else {
                  console.log(` - Shell alias already present in ${path.basename(rcFile)}`);
                }
              }
            }
          } catch (shellErr: any) {
            console.error(` - Error configuring shell alias: ${shellErr.message}`);
          }
        }

        // 5. Sync rules
        console.log('Synchronizing coding rules across all active providers...');
        try {
          await pullRules(workspacePath);
          await pushRules(workspacePath);
          console.log(' - Rules synchronized successfully');
        } catch (syncErr: any) {
          console.error(` - Error syncing rules: ${syncErr.message}`);
        }

        // 6. Launch watcher daemon
        console.log('Launching NextRouter background sync daemon...');
        try {
          if (!isDaemonRunning()) {
            startDaemonBackground(workspacePath);
            console.log(' - Background sync daemon launched successfully!');
          } else {
            console.log(' - Background sync daemon already active');
          }
        } catch (daemonErr: any) {
          console.error(` - Error launching daemon: ${daemonErr.message}`);
        }

        console.log('\n✓ Setup complete!\n');
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Command execution failed:', error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
NextRouter CLI — Command Line Context Router

Usage:
  nextrouter <command> [arguments]

Commands:
  setup                Automate setup of MCP servers, plugins, aliases, and daemon in one click
  status               Show detected workspace providers and active sessions
  sync                 Trigger bidirectional rule file synchronization
  handover <from> [to] [--original] [--out <path>] Generate handover context (briefing or original raw context)
  tokens               Display current token usage metrics against model windows
  daemon [start|stop]  Manage background auto-sync worker daemon
  prune <file> [--write] Strip implementation details from Javascript, Typescript, or Python file
  install-plugin <id|all>  Install NextRouter plugin into a provider (claude-code, cursor, antigravity, copilot, all)
  list-plugins             Show plugin installation status for all providers
  help                 Show this help details

Slash Commands:
  /setup, /status, /sync, /handoff, /tokens, /daemon, /prune, /help
  /plugins, /list-plugins, /install-plugin
`);
}

main();

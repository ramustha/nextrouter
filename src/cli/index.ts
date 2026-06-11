import { getDatabase } from '../store/database';
import { detectActiveProviders } from '../adapters/registry';
import { pullRules, pushRules } from '../engine/rules-sync';
import { generateHandover } from '../engine/handover';
import { getBudgetAnalysis } from '../engine/tokenizer';

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
        const fromProvider = args[1];
        const toProvider = args[2];

        if (!fromProvider) {
          console.error('Error: Missing source provider ID. Usage: nextrouter handover <from-provider> [to-provider]');
          process.exit(1);
        }

        const sessions = db.sessions.all().filter(s => s.provider_id === fromProvider);
        const latest = sessions.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())[0];

        if (!latest) {
          console.error(`Error: No active sessions found in database for provider: ${fromProvider}`);
          process.exit(1);
        }

        console.log(`\nCompiling handover context from session: "${latest.title}"...`);
        const packet = generateHandover(fromProvider, {
          id: latest.id,
          title: latest.title,
          startedAt: latest.started_at,
          lastActiveAt: latest.last_active_at,
          status: latest.status as any,
          tokenCount: latest.token_count,
          messages: latest.messages
        }, toProvider);

        console.log('\n----------------------------------------');
        console.log(packet.rawMarkdown);
        console.log('----------------------------------------\n');
        break;
      }

      case 'tokens': {
        console.log('\n=== Shared Token Pool & Model Budgets ===');
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
  status               Show detected workspace providers and active sessions
  sync                 Trigger bidirectional rule file synchronization
  handover <from> [to] Generate handover context from provider's latest session
  tokens               Display current token usage metrics against model windows
  daemon [start|stop]  Manage background auto-sync worker daemon
  prune <file> [--write] Strip implementation details from Javascript, Typescript, or Python file
  help                 Show this help details

Slash Commands:
  /status, /sync, /handoff, /tokens, /daemon, /prune, /help
`);
}

main();

import { getDatabase } from '../store/database';
import { detectActiveProviders } from '../adapters/registry';
import { pullRules, pushRules } from '../engine/rules-sync';
import { generateHandover } from '../engine/handover';
import { getBudgetAnalysis } from '../engine/tokenizer';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

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
  help                 Show this help details
`);
}

main();

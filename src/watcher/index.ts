import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pullRules, pushRules } from '../engine/rules-sync';
import { eventBus } from './events';

const lastSyncHashes = new Map<string, string>();
let syncTimeout: NodeJS.Timeout | null = null;

export function startWorkspaceWatcher(workspacePath: string) {
  const watchPaths = [
    path.join(workspacePath, 'CLAUDE.md'),
    path.join(workspacePath, '.cursorrules'),
    path.join(workspacePath, 'GEMINI.md'),
    path.join(workspacePath, '.github', 'copilot-instructions.md'),
    path.join(workspacePath, '.cursor', 'rules', '**', '*.mdc'),
    path.join(workspacePath, '.cursor', 'rules', '**', '*.md')
  ];

  console.log(`[NextRouter Watcher] Starting file watcher for workspace: ${workspacePath}`);

  const watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 3
  });

  watcher.on('change', (filePath) => {
    const filename = path.relative(workspacePath, filePath);
    console.log(`[NextRouter Watcher] Detected change in: ${filename}`);
    eventBus.broadcast('file_changed', { filename });

    try {
      if (!fs.existsSync(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      // Loop prevention check: if the hash matches the last hash written by NextRouter, skip
      if (lastSyncHashes.get(filePath) === hash) {
        // Event was self-triggered by our sync engine, clear state and ignore
        lastSyncHashes.delete(filePath);
        return;
      }

      // Debounce rules syncing to avoid conflicts during typing/saving
      if (syncTimeout) clearTimeout(syncTimeout);
      
      syncTimeout = setTimeout(async () => {
        console.log('[NextRouter Watcher] Initiating rule sync...');
        eventBus.broadcast('sync_started', { filename });
        
        // 1. Pull changes into database
        const rules = await pullRules(workspacePath);
        
        // 2. Track hashes of rules we are about to push to prevent loop triggering
        for (const rule of rules) {
          const targetPath = path.join(workspacePath, rule.filename);
          lastSyncHashes.set(targetPath, rule.hash);
        }

        // 3. Push to other providers
        await pushRules(workspacePath);
        console.log('[NextRouter Watcher] Bidirectional rules sync completed.');
        eventBus.broadcast('sync_completed', { timestamp: new Date().toISOString() });
      }, 1000);

    } catch (e) {
      console.error(`[NextRouter Watcher] Error handling change in ${filename}:`, e);
      eventBus.broadcast('sync_failed', { error: (e as any).message });
    }
  });

  watcher.on('error', (error) => {
    console.error('[NextRouter Watcher] Error:', error);
  });

  return watcher;
}

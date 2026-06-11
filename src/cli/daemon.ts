import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../store/database';
import { startWorkspaceWatcher } from '../watcher/index';
import { pullRules, pushRules } from '../engine/rules-sync';

const PID_FILE = path.join(process.cwd(), 'data', 'daemon.pid');
const LOG_FILE = path.join(process.cwd(), 'data', 'daemon.log');

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync(LOG_FILE, logMsg, 'utf8');
  } catch (e) {
    // ignore logging errors
  }
}

/**
 * Checks if specific AI-related processes are running on macOS.
 */
export function getActiveAIProcesses(): string[] {
  try {
    const output = execSync('ps -A -o comm', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    
    const processes = [
      { name: 'Cursor', pattern: 'cursor' },
      { name: 'Claude Code', pattern: 'claude' },
      { name: 'VS Code / Copilot', pattern: 'code' },
      { name: 'Antigravity / Gemini', pattern: 'gemini' }
    ];
    
    const active: string[] = [];
    const lines = output.toLowerCase().split('\n');

    for (const p of processes) {
      if (lines.some(line => line.includes(p.pattern))) {
        active.push(p.name);
      }
    }
    
    return active;
  } catch (e) {
    return [];
  }
}

/**
 * Runs the daemon worker loop.
 */
export async function runDaemonWorker(workspacePath: string) {
  log(`NextRouter Daemon starting up for workspace: ${workspacePath}`);
  log(`Process ID: ${process.pid}`);

  // Write PID to file
  const dir = path.dirname(PID_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PID_FILE, process.pid.toString(), 'utf8');

  // Perform initial rules sync
  try {
    log('Running initial rules synchronization...');
    await pullRules(workspacePath);
    await pushRules(workspacePath);
    log('Initial synchronization completed successfully.');
  } catch (e: any) {
    log(`Initial synchronization failed: ${e.message || e}`);
  }

  // Start the file watcher
  log('Starting workspace file watcher...');
  const watcher = startWorkspaceWatcher(workspacePath);

  // Background monitor loop
  let lastActiveProcesses: string[] = [];
  
  const interval = setInterval(() => {
    const active = getActiveAIProcesses();
    
    // Log process list changes
    const activeStr = active.sort().join(', ');
    const lastActiveStr = lastActiveProcesses.sort().join(', ');
    
    if (activeStr !== lastActiveStr) {
      if (active.length > 0) {
        log(`Active AI editors detected: ${active.join(', ')}`);
      } else {
        log('No active AI editors detected.');
      }
      lastActiveProcesses = active;
    }
  }, 5000);

  // Handle termination signals
  const cleanup = () => {
    log('Daemon shutting down...');
    clearInterval(interval);
    watcher.close();
    if (fs.existsSync(PID_FILE)) {
      try {
        fs.unlinkSync(PID_FILE);
      } catch (e) {}
    }
    log('Daemon stopped.');
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

/**
 * Controller to start the daemon in the background.
 */
export function startDaemonBackground(workspacePath: string) {
  if (isDaemonRunning()) {
    console.log(`Daemon is already running. PID: ${fs.readFileSync(PID_FILE, 'utf8').trim()}`);
    return;
  }

  console.log('Spawning NextRouter daemon in background...');

  // Spawn self with --run flag
  const scriptPath = path.join(workspacePath, 'src', 'cli', 'daemon.ts');
  const logStream = fs.openSync(LOG_FILE, 'a');

  const child = spawn(
    'npx',
    ['tsx', 'src/cli/index.ts', 'daemon', 'run-worker'],
    {
      cwd: workspacePath,
      detached: true,
      stdio: ['ignore', logStream, logStream]
    }
  );

  child.unref();

  // Wait a moment and check if it started
  setTimeout(() => {
    if (isDaemonRunning()) {
      const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
      console.log(`✓ NextRouter daemon started successfully. Background PID: ${pid}`);
      console.log(`Logs are being written to: data/daemon.log`);
    } else {
      console.error('✗ Failed to start daemon in background. Check data/daemon.log for errors.');
    }
  }, 2500);
}

/**
 * Controller to stop the background daemon.
 */
export function stopDaemon() {
  if (!isDaemonRunning()) {
    console.log('Daemon is not running.');
    return;
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = parseInt(pidStr, 10);

  console.log(`Stopping NextRouter daemon (PID: ${pid})...`);
  try {
    process.kill(pid, 'SIGTERM');
    console.log('✓ Daemon stopped successfully.');
  } catch (e: any) {
    console.error(`Failed to kill process ${pid}:`, e.message || e);
    // clean up PID file anyway if process is dead
    try {
      fs.unlinkSync(PID_FILE);
    } catch (err) {}
  }
}

/**
 * Controller to check if daemon is running.
 */
export function getDaemonStatus() {
  if (isDaemonRunning()) {
    const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
    console.log(`Daemon status: RUNNING (PID: ${pid})`);
    const active = getActiveAIProcesses();
    if (active.length > 0) {
      console.log(`Monitored processes currently active: ${active.join(', ')}`);
    } else {
      console.log('Monitored processes: None active (waiting)');
    }
  } else {
    console.log('Daemon status: STOPPED');
  }
}

export function isDaemonRunning(): boolean {
  if (!fs.existsSync(PID_FILE)) return false;
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    // Check if process is running by sending signal 0
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // Process does not exist or signal error, clean up stale PID file
    try {
      fs.unlinkSync(PID_FILE);
    } catch (err) {}
    return false;
  }
}

// If run directly via worker command
if (process.argv[2] === '--run-worker') {
  const workspacePath = process.argv[3] || process.cwd();
  runDaemonWorker(workspacePath).catch(e => {
    log(`Daemon worker crashed: ${e.message || e}`);
  });
}

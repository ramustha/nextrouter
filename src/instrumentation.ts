export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startWorkspaceWatcher } = await import('./watcher/index');
      // Initialize watcher on workspace root
      const workspacePath = process.cwd();
      startWorkspaceWatcher(workspacePath);
    } catch (e) {
      console.error('[NextRouter] Failed to start file watcher in instrumentation:', e);
    }
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // The workspace file watcher is managed by the background daemon process
    // (run-worker) to prevent chokidar from locking files or blocking compilation
    // threads and UI navigation in Next.js Turbopack dev server.
    console.log('[NextRouter] Instrumentation registered. Background Daemon manages file watcher.');
  }
}

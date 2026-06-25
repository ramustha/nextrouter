import { runMcpServer, runMcpSseServer } from '../mcp/server';

const args = process.argv.slice(2);
const sseMode = args.includes('--sse');
let port = 3001;

const portIndex = args.indexOf('--port');
if (portIndex >= 0 && args[portIndex + 1]) {
  port = parseInt(args[portIndex + 1], 10) || 3001;
}

if (sseMode) {
  runMcpSseServer(port).catch((error) => {
    console.error('Fatal error running NextRouter MCP SSE Server:', error);
    process.exit(1);
  });
} else {
  // Run the Model Context Protocol server over stdio
  runMcpServer().catch((error) => {
    console.error('Fatal error running NextRouter MCP Server:', error);
    process.exit(1);
  });
}

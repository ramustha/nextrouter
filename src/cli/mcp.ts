import { runMcpServer } from '../mcp/server';

// Run the Model Context Protocol server over stdio
runMcpServer().catch((error) => {
  console.error('Fatal error running NextRouter MCP Server:', error);
  process.exit(1);
});

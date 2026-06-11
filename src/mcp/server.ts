import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { getDatabase } from '../store/database';
import { generateHandover } from '../engine/handover';
import { pullRules, pushRules } from '../engine/rules-sync';
import { countTokens } from '../engine/tokenizer';

const server = new Server(
  {
    name: 'nextrouter-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_shared_context',
        description: 'Get the current shared context, including active tasks, files, and recent summaries.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'save_context',
        description: 'Save/update the active conversation context for the current provider.',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string', description: 'ID of the provider (e.g. claude-code, cursor)' },
            title: { type: 'string', description: 'Active session title or task goal' },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                  content: { type: 'string' }
                },
                required: ['role', 'content']
              },
              description: 'List of messages in the active chat'
            }
          },
          required: ['providerId', 'title', 'messages']
        }
      },
      {
        name: 'get_handover',
        description: 'Generate a portable Markdown context handover packet to transition to another provider.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceProviderId: { type: 'string', description: 'ID of the current provider' },
            targetProviderId: { type: 'string', description: 'ID of the destination provider' }
          },
          required: ['sourceProviderId']
        }
      },
      {
        name: 'sync_rules',
        description: 'Synchronize rule instructions (.cursorrules, CLAUDE.md, GEMINI.md) across all active providers.',
        inputSchema: {
          type: 'object',
          properties: {
            workspacePath: { type: 'string', description: 'Absolute path to workspace directory' }
          },
          required: ['workspacePath']
        }
      },
      {
        name: 'prune_code',
        description: 'Strip implementation details (function/class bodies) from Javascript, Typescript, or Python code to save context space.',
        inputSchema: {
          type: 'object',
          properties: {
            filepath: { type: 'string', description: 'Relative or absolute path of the file to prune' },
            write: { type: 'boolean', description: 'If true, overwrites the file in place. If false, only returns the pruned outline.' }
          },
          required: ['filepath']
        }
      },
      {
        name: 'get_active_plan',
        description: 'Read the active workspace plan (from plan.md or implementation_plan.md) in the current directory.',
        inputSchema: {
          type: 'object',
          properties: {
            workspacePath: { type: 'string', description: 'Absolute path to workspace directory' }
          },
          required: ['workspacePath']
        }
      }
    ]
  };
});

// Tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const db = getDatabase();
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_shared_context': {
        const sessions = db.sessions.all();
        const activeSessions = sessions.filter(s => s.status === 'active');
        const latestSession = activeSessions.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())[0];
        
        if (!latestSession) {
          return {
            content: [{ type: 'text', text: 'No active shared context available. Start a session or save context first.' }]
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                latestSessionId: latestSession.id,
                title: latestSession.title,
                providerId: latestSession.provider_id,
                lastActiveAt: latestSession.last_active_at,
                tokenCount: latestSession.token_count,
                recentMessages: latestSession.messages?.slice(-3) || []
              }, null, 2)
            }
          ]
        };
      }

      case 'save_context': {
        const { providerId, title, messages } = args as any;
        const sessionId = crypto.randomUUID();
        const now = new Date().toISOString();
        
        let tokenCount = 0;
        const parsedMessages = messages.map((m: any) => {
          const tokens = countTokens(m.content);
          tokenCount += tokens;
          return { ...m, tokens, timestamp: now };
        });

        db.sessions.upsert({
          id: sessionId,
          provider_id: providerId,
          title,
          started_at: now,
          last_active_at: now,
          status: 'active',
          token_count: tokenCount,
          messages: parsedMessages
        });

        // Insert into token usage tracker
        db.tokenUsage.insert({
          provider_id: providerId,
          session_id: sessionId,
          direction: 'input',
          tokens: tokenCount,
          cost: 0,
          timestamp: now
        });

        return {
          content: [
            {
              type: 'text',
              text: `Successfully saved context under session ID ${sessionId}. Total tokens tracked: ${tokenCount}.`
            }
          ]
        };
      }

      case 'get_handover': {
        const { sourceProviderId, targetProviderId } = args as any;
        const sessions = db.sessions.all().filter(s => s.provider_id === sourceProviderId);
        const latestSession = sessions.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())[0];

        if (!latestSession) {
          return {
            content: [{ type: 'text', text: `No sessions found for provider ${sourceProviderId}.` }]
          };
        }

        const normalizedSession = {
          id: latestSession.id,
          title: latestSession.title,
          startedAt: latestSession.started_at,
          lastActiveAt: latestSession.last_active_at,
          status: latestSession.status as 'active' | 'archived',
          tokenCount: latestSession.token_count,
          messages: latestSession.messages
        };

        const packet = generateHandover(sourceProviderId, normalizedSession, targetProviderId);
        
        return {
          content: [
            {
              type: 'text',
              text: packet.rawMarkdown
            }
          ]
        };
      }

      case 'sync_rules': {
        const { workspacePath } = args as any;
        await pullRules(workspacePath);
        await pushRules(workspacePath);
        return {
          content: [{ type: 'text', text: `Rules successfully synchronized across all active providers in ${workspacePath}.` }]
        };
      }

      case 'prune_code': {
        const { filepath, write = false } = args as any;
        const fs = await import('fs');
        const path = await import('path');
        const { compressCode } = await import('../engine/compressor');
        const { countTokens } = await import('../engine/tokenizer');

        const absolutePath = path.resolve(filepath);
        if (!fs.existsSync(absolutePath)) {
          throw new McpError(ErrorCode.InvalidRequest, `File not found at: ${absolutePath}`);
        }

        const stats = fs.statSync(absolutePath);
        if (stats.isDirectory()) {
          throw new McpError(ErrorCode.InvalidRequest, `Path is a directory, not a file: ${absolutePath}`);
        }

        const content = fs.readFileSync(absolutePath, 'utf8');
        const filename = path.basename(absolutePath);
        const originalTokens = countTokens(content);

        const prunedContent = compressCode(filename, content);
        const prunedTokens = countTokens(prunedContent);
        const savedPercent = originalTokens > 0 
          ? Math.round(((originalTokens - prunedTokens) / originalTokens) * 100) 
          : 0;

        if (write) {
          fs.writeFileSync(absolutePath, prunedContent, 'utf8');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                filePath: absolutePath,
                originalTokens,
                prunedTokens,
                savedTokens: originalTokens - prunedTokens,
                savedPercent,
                wasWritten: write,
                prunedContent: write ? undefined : prunedContent
              }, null, 2)
            }
          ]
        };
      }

      case 'get_active_plan': {
        const { workspacePath } = args as any;
        const fs = await import('fs');
        const path = await import('path');
        
        const possibleNames = ['plan.md', 'PLAN.md', 'implementation_plan.md', 'IMPLEMENTATION_PLAN.md'];
        let planContent = '';
        let foundFile = '';
        
        for (const name of possibleNames) {
          const filePath = path.join(workspacePath, name);
          if (fs.existsSync(filePath)) {
            planContent = fs.readFileSync(filePath, 'utf8').trim();
            foundFile = name;
            break;
          }
        }
        
        if (!planContent) {
          return {
            content: [{ type: 'text', text: 'No active plan.md or implementation_plan.md found in the workspace.' }]
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Active Plan loaded from ${foundFile}:\n\n${planContent}`
            }
          ]
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: 'text', text: error.message || 'Unknown error occurred' }]
    };
  }
});

// Setup Stdio resources list
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const db = getDatabase();
  const activeSessions = db.sessions.all().filter(s => s.status === 'active');
  const skills = db.skills.all();

  return {
    resources: [
      {
        uri: 'nextrouter://plan',
        name: 'Active Workspace Plan',
        mimeType: 'text/markdown',
        description: 'The active project roadmap and task plan (plan.md)'
      },
      ...activeSessions.map(s => ({
        uri: `nextrouter://sessions/${s.id}`,
        name: `Shared Session: ${s.title}`,
        mimeType: 'application/json',
        description: `Active context from provider ${s.provider_id}`
      })),
      ...skills.map(sk => ({
        uri: `nextrouter://skills/${sk.id}`,
        name: `Universal Skill: ${sk.name}`,
        mimeType: 'text/markdown',
        description: `Universal rules & guidelines for ${sk.name}`
      }))
    ]
  };
});

// Setup Stdio read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const db = getDatabase();
  const { uri } = request.params;

  if (uri === 'nextrouter://plan') {
    const fs = await import('fs');
    const path = await import('path');
    const possibleNames = ['plan.md', 'PLAN.md', 'implementation_plan.md', 'IMPLEMENTATION_PLAN.md'];
    let planContent = '';
    
    for (const name of possibleNames) {
      const filePath = path.join(process.cwd(), name);
      if (fs.existsSync(filePath)) {
        planContent = fs.readFileSync(filePath, 'utf8').trim();
        break;
      }
    }
    
    return {
      contents: [{
        uri,
        mimeType: 'text/markdown',
        text: planContent || 'No active plan found.'
      }]
    };
  }

  if (uri.startsWith('nextrouter://sessions/')) {
    const sessionId = uri.replace('nextrouter://sessions/', '');
    const session = db.sessions.get(sessionId);
    if (!session) {
      throw new McpError(ErrorCode.InvalidRequest, `Session ${sessionId} not found`);
    }
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(session, null, 2)
      }]
    };
  }

  if (uri.startsWith('nextrouter://skills/')) {
    const skillId = uri.replace('nextrouter://skills/', '');
    const skill = db.skills.get(skillId);
    if (!skill) {
      throw new McpError(ErrorCode.InvalidRequest, `Skill ${skillId} not found`);
    }
    return {
      contents: [{
        uri,
        mimeType: 'text/markdown',
        text: skill.content
      }]
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
});

export async function runMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NextRouter MCP Server running on stdio');
}

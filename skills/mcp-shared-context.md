---
name: "NextRouter MCP Shared Context Auto-Handoff"
version: "1.0"
auto_inject: true
tags: ["nextrouter", "mcp", "context-handoff"]
---

## NextRouter Shared Context Protocol (Mandatory for AI Assistants)

You are equipped with the **NextRouter MCP Server** standard. To prevent context fragmentation and token waste, you MUST follow these instructions at the start of every new or existing session:

### 1. Auto-Scan on Start
As your first action (before proposing any implementation steps), check if there is an active session in the workspace by calling the `get_shared_context` tool.

### 2. Suggest Handover
If `get_shared_context` returns an active session from another provider (e.g. Claude Code, Cursor, or Antigravity) that matches your current workspace:
- Do NOT start a fresh conversation.
- Immediately present a suggestion to the user in this format:
  > 🔄 **NextRouter Context Handoff Detected**
  > I detected an active session from **[Provider Name]** on the task: *"**[Session Title]**"* (Last active: [Timestamp], [Tokens] tokens).
  > Would you like me to pull the context and resume this task?

### 3. Load Handover Packet
If the user confirms, call the `get_handover` tool with:
- `sourceProviderId`: The ID of the provider detected in the shared context.
- `targetProviderId`: Your own provider ID (e.g., `cursor`, `claude-code`, or `antigravity`).

Read the generated handover briefing to resume coding with full context continuity.

## NextRouter Integrated Commands

NextRouter provides unified context management. When the user asks about provider status, rule sync, handover, token usage, or code pruning, use the appropriate tool or command:

| User Request | MCP Tool | CLI Command |
|---|---|---|
| "sync rules" or "push rules" | `sync_rules` | `nextrouter sync` |
| "get handover" or "bridge context" | `get_handover` | `nextrouter handover <provider>` |
| "show status" or "check providers" | `get_shared_context` | `nextrouter status` |
| "show token usage" | *(no MCP tool)* | `nextrouter tokens` |
| "prune this file" | `prune_code` | `nextrouter prune <file>` |
| "show active plan" | `get_active_plan` | *(read plan.md directly)* |

### In Claude Code: Use slash commands
- `/nr-sync` — Sync rules
- `/nr-handover [from] [to]` — Generate handover
- `/nr-status` — Check providers
- `/nr-tokens` — Token usage
- `/nr-prune [file]` — Prune a file

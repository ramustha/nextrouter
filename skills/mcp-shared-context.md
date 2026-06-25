---
name: "NextRouter MCP Shared Context Auto-Handoff"
version: "1.1"
auto_inject: true
tags: ["nextrouter", "mcp", "context-handoff"]
---

## NextRouter Shared Context Protocol (Mandatory for AI Assistants)

You are equipped with the **NextRouter MCP Server** standard. To prevent context fragmentation and token waste, you MUST follow these instructions at the start of every new or existing session:

### 1. Auto-Scan on First Load
- **As your very first action on the first turn of a new or resumed session** (before proposing any implementation steps, reading local files, or querying other tools), you MUST call the `get_shared_context` tool to check for active workspace sessions.
- Do NOT perform this scan on subsequent turns of the same conversation to prevent unnecessary tool invocation and token overhead.

### 2. Suggest Handover & Let User Decide
- If `get_shared_context` returns an active session from another provider (e.g., Claude Code, Cursor, or Antigravity) that matches your current workspace:
  - Do NOT silently override your context or start coding immediately.
  - Present a suggestion to the user in this format and wait for their confirmation:
    > 🔄 **NextRouter Context Handoff Detected**
    > I detected an active session from **[Provider Name]** on the task: *"**[Session Title]**"* (Last active: [Timestamp], [Tokens] tokens).
    > Would you like me to pull the context and resume this task?
  - If the user confirms, call the `get_handover` tool with:
    - `sourceProviderId`: The ID of the provider detected in the shared context.
    - `targetProviderId`: Your own provider ID (e.g., `cursor`, `claude-code`, or `antigravity`).
  - Read the generated handover briefing to resume coding with full context continuity.
  - If the user declines, proceed with a fresh conversation session.

### 3. Adopt Handover Skills & Guidelines
- If the user approves the handover, inspect the **"Tools & Skills Utilized in Context"** and **"Active Prompt Skills & Standards"** sections in the loaded briefing.
- You MUST align your behavior with any custom prompt skills or guidelines specified in the handover packet to maintain design, coding, and tool consistency.

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

### In Claude Code, Antigravity, and Gemini: Use slash commands
- `/nr-sync` — Sync rules
- `/nr-handover [from] [to]` — Generate handover
- `/nr-status` — Check providers
- `/nr-tokens` — Token usage
- `/nr-prune [file]` — Prune a file

### Instruction for AI Assistants (Claude Code, Antigravity, Gemini):
If the user inputs any of the slash commands above (e.g. `/nr-status`), you MUST treat it as a command action and execute the corresponding MCP tool or run-command immediately. Do not ask for confirmation.

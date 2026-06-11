# NextRouter — Multi-AI Coding Assistant Context Hub

NextRouter is a unified, 100% local platform to **monitor**, **share context**, and **synchronize rules** across multiple AI coding assistants (including Claude Code, Cursor, GitHub Copilot, and Antigravity).

---

## 🚀 Key Features

1. **⚡ Context Bridge**: Compile session handover packages to switch between providers without losing your active task goals, decisions, or recent messages.
2. **💬 Multi-Assistant Conversation History**: Full extraction and visual rendering of active chat histories for **Claude Code CLI** and **Cursor** sessions directly inside the dashboard.
3. **🔍 Unified Timeline Filtering**: Glassmorphic filter tabs to navigate and filter sessions instantly by specific AI providers with dedicated theme colors.
4. **📁 Git Integration**: Automatically detect changed files in the workspace and view inline green/red unified diff lines before bridging context.
5. **✂️ Code Pruner**: Strip internal implementation bodies from JavaScript, TypeScript, and Python code, saving up to 85% of tokens.
6. **📊 Cost & Token Analytics**: Calculate token consumption and estimate accrued pricing per provider and session.
7. **🔔 Native Desktop Notifications**: Get macOS native notifications when active token budgets exceed a 90% threshold.
8. **🤖 Background CLI Sync Daemon**: A background service that checks active AI processes (`Cursor`, `claude`, etc.) and automatically syncs rules when active.
9. **🔌 Model Context Protocol (MCP)**: Universal MCP stdio server to let Cursor or Claude Code query shared sessions and skills directly.

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Web Dashboard
Launches the dark/glassmorphic web dashboard at `http://localhost:3000`:
```bash
npm run dev
```

### 3. Run MCP Server (Stdio)
Use this command when linking NextRouter to Cursor or Claude Code:
```bash
npm run mcp
```

### 4. Background Sync Daemon Commands
```bash
npm run cli daemon start    # Start background process daemon
npm run cli daemon status   # Check daemon running PID and monitored editors
npm run cli daemon stop     # Terminate background daemon process
```

### 5. CLI Commands
```bash
npm run cli status               # Show active providers and sessions
npm run cli sync                 # Manually trigger rule sync across files
npm run cli tokens               # Inspect token pool vs model context windows
npm run cli handover <provider>  # Generate handover briefing from latest session
```

---

## 🏗️ Architecture

- **Local Storage**: Privacy-first file-backed JSON database at `data/db.json` (bypassing native C++ SQLite binary compilation issues).
- **Rule Watcher**: Chokidar-based file watcher that bidirectionally synchronizes `.cursorrules`, `CLAUDE.md`, and `GEMINI.md`.
- **Universal Skills**: Prompts and rules written in markdown inside `/skills/` that are automatically merged into all provider configurations on sync.

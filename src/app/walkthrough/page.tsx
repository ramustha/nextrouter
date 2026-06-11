'use client';

import React, { useState } from 'react';

export default function OnboardingWalkthroughPage() {
  const [activeStep, setActiveStep] = useState('mcp');
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [copiedAntigravity, setCopiedAntigravity] = useState(false);
  const [activeProviderTab, setActiveProviderTab] = useState('claude');
  const [settingUp, setSettingUp] = useState(false);
  const [selectedCliCommand, setSelectedCliCommand] = useState('status');

  const steps = [
    { id: 'mcp', name: '1. MCP Setup', icon: '🔌' },
    { id: 'handoff', name: '2. Auto-Handoff', icon: '🔄' },
    { id: 'bridge', name: '3. Context Bridge', icon: '⚡' },
    { id: 'rules', name: '4. Rules Sync', icon: '⚙️' },
    { id: 'skills', name: '5. Universal Skills', icon: '🧩' },
    { id: 'providers', name: '6. Provider Guides', icon: '🤖' },
    { id: 'integrations', name: '7. Commands & Plugins', icon: '🔌' }
  ];

  const mcpCommand = `npx tsx /Users/ramadhani.musthofa/Work/nextrouter/src/cli/mcp.ts`;
  const claudeCommand = `claude mcp add nextrouter npx tsx /Users/ramadhani.musthofa/Work/nextrouter/src/cli/mcp.ts`;
  const antigravityCommand = `python3 -c "import json, os; p=os.path.expanduser('~/.gemini/antigravity/mcp_config.json'); d=json.load(open(p)) if os.path.exists(p) else {'mcpServers':{}}; d.setdefault('mcpServers',{})['nextrouter']={'command':'npx','args':['tsx','/Users/ramadhani.musthofa/Work/nextrouter/src/cli/mcp.ts']}; json.dump(d,open(p,'w'),indent=2)"`;

  const mockCliOutputs: Record<string, { cmd: string; output: React.ReactNode }> = {
    status: {
      cmd: 'nextrouter status',
      output: (
        <div>
          <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>=== NextRouter CLI Status ===</span><br />
          <span>Workspace Path: /Users/ramadhani.musthofa/Work/nextrouter</span><br /><br />
          <span style={{ color: '#22d3ee', fontWeight: 'bold' }}>Active Providers Detected (3):</span><br />
          <span style={{ color: '#10b981' }}> ✓ Claude Code (claude-code)</span><br />
          <span style={{ color: '#10b981' }}> ✓ Cursor (cursor)</span><br />
          <span style={{ color: '#10b981' }}> ✓ Antigravity (antigravity)</span><br /><br />
          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Active Sessions in DB (3):</span><br />
          <span> - [claude-code] &quot;Implement DB Connection helper&quot; (1,500 tokens)</span><br />
          <span> - [cursor] &quot;Fix sidebar routing flex alignment&quot; (4,200 tokens)</span><br />
          <span> - [antigravity] &quot;Add Antigravity MCP Setup integration&quot; (850 tokens)</span>
        </div>
      )
    },
    sync: {
      cmd: 'nextrouter sync',
      output: (
        <div>
          <span>Initiating bidirectional rule sync...</span><br />
          <span style={{ color: '#38bdf8' }}>  ➔ Pulling rules from .cursorrules, CLAUDE.md, GEMINI.md</span><br />
          <span style={{ color: '#38bdf8' }}>  ➔ Merging rules with 2 active custom skills</span><br />
          <span style={{ color: '#38bdf8' }}>  ➔ Propagating unified rules to all provider config files</span><br />
          <span style={{ color: '#4ade80', fontWeight: 'bold' }}>✓ Rules synced successfully across all active providers!</span>
        </div>
      )
    },
    tokens: {
      cmd: 'nextrouter tokens',
      output: (
        <div>
          <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>=== Shared Token Pool &amp; Model Budgets ===</span><br />
          <span>Total Active Tokens: 6,550</span><br /><br />
          <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>Usage vs Model Context Windows:</span><br />
          <span> - [<span style={{ color: '#4ade80' }}>🟢 SAFE</span>] Gemini 1.5 Pro (Antigravity): 0.3% used (6,550 / 2,000,000)</span><br />
          <span> - [<span style={{ color: '#4ade80' }}>🟢 SAFE</span>] Claude 3.5 Sonnet (Claude Code): 3.2% used (6,550 / 200,000)</span><br />
          <span> - [<span style={{ color: '#4ade80' }}>🟢 SAFE</span>] GPT-4o (Cursor): 5.1% used (6,550 / 128,000)</span>
        </div>
      )
    },
    daemon: {
      cmd: 'nextrouter daemon status',
      output: (
        <div>
          <span>Daemon status: <span style={{ color: '#4ade80', fontWeight: 'bold' }}>RUNNING</span> (PID: 92450)</span><br />
          <span>Monitored processes currently active: Cursor, Claude Code, VS Code / Copilot</span><br />
          <span>Polling Interval: 5 seconds</span><br />
          <span>Last Sync Event: 2026-06-12 06:25:12 (<span style={{ color: '#fbbf24' }}>Auto-sync triggered by .cursorrules update</span>)</span>
        </div>
      )
    }
  };

  function handleCopy(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleOneClickSetup() {
    setSettingUp(true);
    try {
      const res = await fetch('/api/system/setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Setup completed successfully!\n\n${data.logs.join('\n')}`);
      } else {
        alert(`Setup failed: ${data.error || 'Unknown error'}\n\n${(data.logs || []).join('\n')}`);
      }
    } catch (e: any) {
      alert(`Setup error: ${e.message || e}`);
    } finally {
      setSettingUp(false);
    }
  }

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Onboarding Guide & Tutorials</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
          Learn how to get the most out of NextRouter context sharing, monitoring, and rules syncing features
        </p>
      </div>

      {/* Tabs navigation */}
      <div style={{
        display: 'flex',
        gap: '12px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px',
        overflowX: 'auto'
      }}>
        {steps.map(s => (
          <button 
            key={s.id}
            onClick={() => setActiveStep(s.id)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: activeStep === s.id ? 'var(--color-primary-glow)' : 'transparent',
              border: `1px solid ${activeStep === s.id ? 'var(--border-color-active)' : 'transparent'}`,
              color: activeStep === s.id ? 'var(--color-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: activeStep === s.id ? 600 : 500,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'var(--transition-smooth)',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{s.icon}</span>
            <span>{s.name}</span>
          </button>
        ))}
      </div>

      {/* Content panel based on active step */}
      <div className="glass-panel" style={{ padding: '32px', minHeight: '400px' }}>
        
        {activeStep === 'mcp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>🔌 Connecting the Model Context Protocol (MCP) Server</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Exposing NextRouter as an MCP server allows Claude Code, Cursor, and Antigravity to query your database, count tokens, sync rules, and automatically discover active sessions.
            </p>

            {/* One-Click Setup Alert Card */}
            <div style={{ 
              background: 'rgba(139, 92, 246, 0.08)', 
              border: '1px solid var(--border-color-active)', 
              borderRadius: '16px', 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              animation: 'pulse-glow 3s infinite'
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span>⚡</span> One-Click Auto Setup (Recommended)
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Click this button to configure everything automatically on your local laptop: registers MCP servers in Claude, Cursor, and Antigravity, adds shell alias commands, syncs all coding rules/skills, and runs the background daemon process.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleOneClickSetup}
                disabled={settingUp}
                style={{
                  width: 'fit-content',
                  padding: '12px 24px',
                  background: 'linear-gradient(to right, #8b5cf6, #06b6d4)',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(139, 92, 246, 0.35)'
                }}
              >
                {settingUp ? '⚙️ Automating Setup...' : '⚡ Configure Local Laptop Automatically'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎨</span> Cursor Setup
                </h3>
                <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  <li>Open Cursor Settings → <strong>Features</strong> → <strong>MCP</strong>.</li>
                  <li>Click <strong>+ Add New MCP Server</strong>.</li>
                  <li>Enter the parameters:
                    <ul style={{ paddingLeft: '20px', marginTop: '6px', listStyleType: 'square' }}>
                      <li><strong>Name</strong>: <code>NextRouter</code></li>
                      <li><strong>Type</strong>: <code>command</code> (or <code>stdio</code>)</li>
                      <li><strong>Command</strong>:</li>
                    </ul>
                  </li>
                </ol>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  background: 'rgba(0, 0, 0, 0.3)', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginTop: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>{mcpCommand}</span>
                  <button className="btn btn-secondary" onClick={() => handleCopy(mcpCommand, setCopiedMcp)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    {copiedMcp ? '✅ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🐚</span> Claude Code Setup
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Run the following CLI command in your terminal inside your active project:
                </p>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  background: 'rgba(0, 0, 0, 0.3)', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>{claudeCommand}</span>
                  <button className="btn btn-secondary" onClick={() => handleCopy(claudeCommand, setCopiedClaude)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                    {copiedClaude ? '✅ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🌌</span> Antigravity Setup
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5' }}>
                  Run the following command in your terminal to safely configure the Antigravity global MCP server (merging into <code>~/.gemini/antigravity/mcp_config.json</code> without overwriting existing servers):
                </p>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  background: 'rgba(0, 0, 0, 0.3)', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ flex: 1, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{antigravityCommand}</span>
                  <button className="btn btn-secondary" onClick={() => handleCopy(antigravityCommand, setCopiedAntigravity)} style={{ padding: '6px 12px', fontSize: '0.75rem', alignSelf: 'flex-start' }}>
                    {copiedAntigravity ? '✅ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>♊</span> Gemini / Google AI Setup
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5' }}>
                  Gemini integrates rules via project-level Markdown files and tool definitions:
                </p>
                <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  <li><strong>Rules File:</strong> Create a <code>GEMINI.md</code> in your project root. NextRouter automatically synchronizes global prompt rules and custom skills into this file during the Rules Sync step.</li>
                  <li><strong>Prompt Injection:</strong> Prepend the content of <code>GEMINI.md</code> as system instructions in your Gemini API requests or model configuration.</li>
                  <li><strong>MCP Client Integration:</strong> Use the official MCP JS/Python SDK to register NextRouter's stdio transport command (<code>npx tsx /Users/ramadhani.musthofa/Work/nextrouter/src/cli/mcp.ts</code>) as an active tool.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeStep === 'handoff' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>🔄 Automated Handoffs via Shared Context</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
              We have pre-configured a default universal skill in your workspace that automates handovers when you launch a session with any assistant.
            </p>
            <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid var(--border-color-active)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--color-primary)', marginBottom: '10px' }}>How it works:</h3>
              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                <li>NextRouter automatically loaded the skill located at <code style={{ color: 'var(--text-main)' }}>skills/mcp-shared-context.md</code>.</li>
                <li>When you synchronize rules (using the <strong>Push & Sync</strong> button on the Rules page or running <code>npm run cli sync</code>), this instruction gets auto-injected into `.cursorrules`, `CLAUDE.md`, and `GEMINI.md`.</li>
                <li>When you start a new conversation in Claude Code, Cursor, or Antigravity, the AI reads this instruction and immediately uses the MCP tools to query the active shared context database.</li>
                <li>If the model detects an active conversation from another provider, it will automatically prompt you:
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '16px', 
                    background: 'rgba(0, 0, 0, 0.3)', 
                    borderRadius: '8px', 
                    borderLeft: '4px solid var(--color-primary)',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}>
                    🔄 <strong>NextRouter Context Handoff Detected</strong><br/>
                    I detected an active session from <strong>Claude Code</strong> on the task: <em>"Implement DB Connection helper"</em>. Would you like me to pull the context and resume this task?
                  </div>
                </li>
                <li>Saying <strong>"yes"</strong> makes the model load the handover packet and resume work seamlessly without you copying anything manually!</li>
              </ol>
            </div>
          </div>
        )}

        {activeStep === 'bridge' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>⚡ Copy Handovers manually via Context Bridge</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
              If you are using a provider that does not support MCP (like Copilot Chat) or want a quick copyable summary, you can compile handover briefs manually using the Context Bridge tab.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              marginTop: '12px'
            }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>1. Select Source & Target</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Select the provider you are switching <strong>from</strong> (e.g. Claude Code) and the target provider you are switching <strong>to</strong> (e.g. Cursor).
                </p>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>2. Load the Session</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  The dropdown will automatically pull active logs scanned from your disk. Select the conversation you want to handover.
                </p>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>3. Generate & Copy</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Click <strong>Generate Handover Packet</strong>, copy the markdown, and paste it directly into your new assistant session. The AI will ingest the state and resume work immediately!
                </p>
              </div>
            </div>
          </div>
        )}

        {activeStep === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>⚙️ Syncing System Rules Across Providers</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Normally, you would duplicate rules across <code>.cursorrules</code>, <code>CLAUDE.md</code>, and <code>GEMINI.md</code>. The Rules Manager solves this.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>🖊️</span>
                <div>
                  <h4 style={{ fontWeight: 600 }}>Edit Rules in One Tab</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Edit any provider rules configuration file using the built-in text editor.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>🔄</span>
                <div>
                  <h4 style={{ fontWeight: 600 }}>Bidirectional Rule Synchronization</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Clicking "Push & Sync" translates and synchronizes changes to all other configuration formats automatically.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>👀</span>
                <div>
                  <h4 style={{ fontWeight: 600 }}>Rules Watching</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>NextRouter runs a background file watcher. When you save a rule file locally in your IDE, the changes are automatically parsed, loaded to the dashboard database, and synced to other providers.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeStep === 'skills' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>🧩 Creating Universal Skills & Custom Rules</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Universal Skills are prompt packages or coding standards that apply to <strong>all</strong> assistants. NextRouter lets you manage them globally.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Create via Dashboard</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Navigate to the <strong>Universal Skills</strong> tab, click <strong>Create New Skill</strong>, write your rules in markdown, and check <strong>Auto-inject this skill</strong>. The next sync will propagate it to all providers.
                </p>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Create via Git/Filesystem</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Write a markdown file inside the <code>skills/</code> folder in your project root. You can configure versioning and auto-injection settings by writing a simple YAML frontmatter block at the top of the file.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeStep === 'providers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>🤖 Provider Integration Guides</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
              NextRouter coordinates context budgets, rules, and timelines across multiple active coding assistants. Select a provider below to view its onboarding details:
            </p>

            {/* Sub-tabs for Providers */}
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              background: 'rgba(255, 255, 255, 0.02)', 
              padding: '6px', 
              borderRadius: '12px', 
              width: 'fit-content', 
              border: '1px solid var(--border-color)',
              marginBottom: '8px'
            }}>
              {[
                { id: 'claude', name: 'Claude Code', color: '#8b5cf6' },
                { id: 'cursor', name: 'Cursor', color: '#06b6d4' },
                { id: 'copilot', name: 'GitHub Copilot', color: '#10b981' },
                { id: 'antigravity', name: 'Antigravity', color: '#f59e0b' },
                { id: 'gemini', name: 'Gemini / Google AI', color: '#4285f4' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setActiveProviderTab(p.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeProviderTab === p.id ? p.color : 'transparent',
                    color: activeProviderTab === p.id ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Claude Code Details */}
            {activeProviderTab === 'claude' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#a78bfa' }}>🌟 Seamless Claude Code Handoffs</h3>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                    <li><strong>Context Synchronization:</strong> NextRouter automatically monitors active session log files located in your home directory (e.g. <code>~/.claude.jsonl</code> or <code>~/.claude/</code>) to sync conversation states in real-time.</li>
                    <li><strong>Instructions Standard:</strong> NextRouter targets the <code>CLAUDE.md</code> file in your project root. Any updates made in the Rules Manager or global skills will be injected directly here.</li>
                    <li><strong>Connecting MCP Server:</strong> Simply execute the <code>claude mcp add nextrouter ...</code> command as described in the <strong>MCP Setup</strong> tab to enable Claude Code to call NextRouter APIs.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Cursor Details */}
            {activeProviderTab === 'cursor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#22d3ee' }}>🌟 Advanced Cursor Chat Timeline Resolution</h3>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                    <li><strong>SQLite Integration:</strong> NextRouter reads local Cursor databases (such as <code>~/.cursor/chats/*.db</code> files) recursively, parsing messages, token counts, and resolving workspace directories directly.</li>
                    <li><strong>Eviction-Resistant Cache:</strong> Even if Cursor removes projects from its "Recently Opened" cache, NextRouter reconstructs and resolves paths using user messages and DB metadata.</li>
                    <li><strong>Cursor Rules:</strong> NextRouter targets the <code>.cursorrules</code> file in your project root to auto-sync rules and custom skills.</li>
                    <li><strong>MCP Connection:</strong> Configure NextRouter as an MCP server inside Cursor Features to allow Cursor to query timeline data.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Copilot Details */}
            {activeProviderTab === 'copilot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#34d399' }}>🌟 Copilot Chat Handover Guides</h3>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                    <li><strong>Custom Instructions:</strong> GitHub Copilot in VS Code reads instructions from <code>.github/copilot-instructions.md</code>. NextRouter targets this file to sync unified project standards.</li>
                    <li><strong>Manual Handovers:</strong> Since Copilot doesn't expose a database API, use the **Context Bridge** to compile handovers manually, copy the markdown briefing, and paste it into the Copilot chat box to reconstruct context.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Antigravity Details */}
            {activeProviderTab === 'antigravity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#fbbf24' }}>🌟 Antigravity Native Observability</h3>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                    <li><strong>Native Logs:</strong> Antigravity reads session logs directly from the project's local directory (e.g. <code>.gemini/antigravity/transcript.jsonl</code>) to trace agent coding steps and execution statuses.</li>
                    <li><strong>Instructions Standard:</strong> NextRouter compiles rules and injects them into <code>GEMINI.md</code> in your project root to control Antigravity prompts.</li>
                    <li><strong>Zero-Config Monitoring:</strong> Token budgets, Git branch name, and active workspace paths are resolved automatically out-of-the-box.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Gemini Details */}
            {activeProviderTab === 'gemini' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ background: 'rgba(66, 133, 244, 0.05)', border: '1px solid rgba(66, 133, 244, 0.15)', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#669df6' }}>🌟 Gemini Assistant Integration & Rules Sync</h3>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                    <li><strong>Standard Rules:</strong> NextRouter reads and writes rules to <code>GEMINI.md</code> in your project root, translating and syncing global system prompts dynamically.</li>
                    <li><strong>Antigravity Workspace:</strong> Antigravity leverages Gemini's long context window. System-level settings and prompt directions are parsed directly from <code>GEMINI.md</code>.</li>
                    <li><strong>Tool Execution:</strong> Ensure your Gemini API runner or CLI wrapper is equipped with tool call definitions pointing to the NextRouter MCP server to enable autonomous directory indexing and context recall.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {activeStep === 'integrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)', marginBottom: '8px' }}>🔌 Command &amp; Plugins Feature Integration Plan</h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                We plan to expand NextRouter support by delivering native terminal commands and IDE extensions/plugins. This will enable context sharing and rules management without having to open the web dashboard.
              </p>
            </div>

            {/* Premium feature cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px'
            }}>
              {/* Item 1 */}
              <div className="glass-panel" style={{ 
                padding: '24px', 
                border: '1px solid rgba(139, 92, 246, 0.15)',
                background: 'rgba(139, 92, 246, 0.02)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#a78bfa', fontWeight: 600 }}>🐚 CLI Tool Sync</h3>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>AVAILABLE</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Control bridging and handovers directly from your terminal using standard commands. Run status checks, trigger rule syncs, or spin up the background watcher daemon without leaving your shell.
                </p>
              </div>

              {/* Item 2 */}
              <div className="glass-panel" style={{ 
                padding: '24px', 
                border: '1px solid rgba(6, 182, 212, 0.15)',
                background: 'rgba(6, 182, 212, 0.02)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#22d3ee', fontWeight: 600 }}>💬 Slash Commands</h3>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>PLANNED</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Enable slash commands (e.g. <code>/handoff</code> or <code>/sync</code>) directly in your editor chat terminal when running Claude Code, automatically loading handover packages from the MCP server.
                </p>
              </div>

              {/* Item 3 */}
              <div className="glass-panel" style={{ 
                padding: '24px', 
                border: '1px solid rgba(16, 185, 129, 0.15)',
                background: 'rgba(16, 185, 129, 0.02)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#34d399', fontWeight: 600 }}>🧩 Editor Extension</h3>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>PLANNED</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  A dedicated VS Code/Cursor Extension and JetBrains Plugin that tracks active document focus, cursor selections, and automatically keeps rules updated inside the IDE side panel in real-time.
                </p>
              </div>
            </div>

            {/* Interactive Simulator Section */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '6px' }}>💻 Interactive CLI Terminal Playground</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Explore how NextRouter behaves on the command line. Select a CLI command below to simulate its stdout output inside a local macOS terminal session:
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'status', label: 'nextrouter status', desc: 'Check active workspace states' },
                  { id: 'sync', label: 'nextrouter sync', desc: 'Sync rules across providers' },
                  { id: 'tokens', label: 'nextrouter tokens', desc: 'Inspect context budgets' },
                  { id: 'daemon', label: 'nextrouter daemon status', desc: 'Inspect background worker' }
                ].map(cmd => (
                  <button
                    key={cmd.id}
                    onClick={() => setSelectedCliCommand(cmd.id)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      background: selectedCliCommand === cmd.id ? 'var(--color-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${selectedCliCommand === cmd.id ? 'var(--border-color-active)' : 'var(--border-color)'}`,
                      color: selectedCliCommand === cmd.id ? 'var(--color-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                    }}
                    title={cmd.desc}
                  >
                    <code>{cmd.label}</code>
                  </button>
                ))}
              </div>

              {/* Terminal Window Mockup */}
              <div style={{
                background: '#07080c',
                border: '1px solid #1f2937',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: '#e5e7eb'
              }}>
                {/* Terminal Header Bar */}
                <div style={{
                  background: '#111827',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid #1f2937'
                }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  <span style={{ marginLeft: 'auto', marginRight: 'auto', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                    zsh — nextrouter CLI
                  </span>
                </div>

                {/* Terminal Body */}
                <div style={{ padding: '20px', minHeight: '220px', lineHeight: '1.6', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  <div style={{ color: '#9ca3af', marginBottom: '8px' }}>Last login: Fri Jun 12 06:25:40 on ttys003</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ color: '#34d399' }}>ramadhani@mbp</span>
                    <span style={{ color: '#818cf8' }}>~/Work/nextrouter</span>
                    <span style={{ color: '#f472b6' }}>🌿 main</span>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ color: '#38bdf8', marginRight: '8px' }}>$</span>
                    <span style={{ fontWeight: 'bold' }}>{mockCliOutputs[selectedCliCommand].cmd}</span>
                  </div>
                  <div style={{ animation: 'fadeIn 0.15s ease-out' }}>
                    {mockCliOutputs[selectedCliCommand].output}
                  </div>
                  <div style={{ display: 'inline-block', width: '8px', height: '15px', background: '#e5e7eb', marginLeft: '4px', verticalAlign: 'middle', animation: 'blink 1s infinite', marginTop: '12px' }} />
                </div>
              </div>
            </div>

            {/* Extension Blueprint and roadmap */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋</span> IDE Extension &amp; Slash Command Roadmap
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px'
              }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#a78bfa' }}>●</span> VS Code &amp; Cursor Extension API
                  </h4>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    <li><strong>Focus Tracking:</strong> Listen to <code>onDidChangeActiveTextEditor</code> to dynamically push the active file name to NextRouter context.</li>
                    <li><strong>Interactive Sidebar:</strong> Sidebar view showing token metrics, Git status, and a one-click manual bridge copy block.</li>
                    <li><strong>Diagnostic Sync:</strong> Feed compilation errors directly to NextRouter's memory, giving target assistants context on recent compile breaks.</li>
                  </ul>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#22d3ee' }}>●</span> Slash Commands Protocol
                  </h4>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    <li><strong>/handoff:</strong> Instantly fetches the latest session context from the other assistant and writes a summarized briefing inside the chat editor.</li>
                    <li><strong>/sync:</strong> Force-refreshes all configuration rules, custom skills, and system profiles on-demand.</li>
                    <li><strong>/prune:</strong> Runs the Interactive Code Pruner directly on files in scope inside the chat context to save input budget.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

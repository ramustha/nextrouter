'use client';

import React, { useState, useEffect } from 'react';

export default function OnboardingWalkthroughPage() {
  const [activeStep, setActiveStep] = useState('mcp');
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [copiedAntigravity, setCopiedAntigravity] = useState(false);
  const [activeProviderTab, setActiveProviderTab] = useState('claude');
  const [settingUp, setSettingUp] = useState(false);
  const [selectedCliCommand, setSelectedCliCommand] = useState('status');
  const [pluginStatuses, setPluginStatuses] = useState<Array<{
    providerId: string;
    providerName: string;
    color: string;
    installed: boolean;
    installedFiles: string[];
    missingFiles: string[];
  }>>([]);
  const [installingPlugin, setInstallingPlugin] = useState<string>('');
  const [pluginLogs, setPluginLogs] = useState<Record<string, string[]>>({});

  async function loadPluginStatuses() {
    try {
      const res = await fetch('/api/plugins');
      if (res.ok) {
        const data = await res.json();
        setPluginStatuses(data);
      }
    } catch (e) {
      console.error('Error loading plugin statuses:', e);
    }
  }

  async function handleInstallPlugin(providerId: string) {
    setInstallingPlugin(providerId);
    try {
      const res = await fetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      });
      const data = await res.json();
      setPluginLogs(prev => ({ ...prev, [providerId]: data.logs || [] }));
      await loadPluginStatuses();
    } catch (e) {
      console.error('Error installing plugin:', e);
    } finally {
      setInstallingPlugin('');
    }
  }

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

  useEffect(() => {
    if (activeStep === 'integrations') {
      loadPluginStatuses();
    }
  }, [activeStep]);

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
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#22d3ee' }}>🖱️ Cursor — MCP + Rules Integration</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 1 — Install the NextRouter Plugin</strong>
                      <p>Use the Install Plugins step (step 7) or run this command. It writes two files: an MDC rule and the MCP server config.</p>
                      <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#e2e8f0', marginTop: '8px', overflowX: 'auto' }}>{`npx tsx src/cli/index.ts install-plugin cursor`}</pre>
                      <p style={{ marginTop: '8px', fontSize: '0.82rem' }}>This creates <code>.cursor/rules/nextrouter-commands.mdc</code> (always-applied rule) and <code>.cursor/mcp.json</code> (MCP server registration).</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 2 — Restart Cursor</strong>
                      <p>Cursor reads <code>.cursor/mcp.json</code> on startup. Restart Cursor (or reload the window with Cmd+Shift+P → &quot;Reload Window&quot;) to activate the MCP connection.</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 3 — Verify MCP is Active</strong>
                      <p>In Cursor chat, ask: <em>&quot;What tools do you have available?&quot;</em> — you should see <code>get_shared_context</code>, <code>get_handover</code>, <code>sync_rules</code>, and others listed.</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>How It Works</strong>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li><strong>Session reading:</strong> NextRouter reads Cursor&apos;s local SQLite chat databases from <code>~/.cursor/chats/</code> to extract sessions, token counts, and workspace paths.</li>
                        <li><strong>Rules sync:</strong> NextRouter reads/writes <code>.cursorrules</code> and <code>.cursor/rules/*.mdc</code>. Universal skills are injected automatically.</li>
                        <li><strong>MDC rule:</strong> The <code>nextrouter-commands.mdc</code> rule has <code>alwaysApply: true</code>, meaning Cursor loads it in every chat — no user action needed.</li>
                      </ul>
                    </div>
                    <div style={{ padding: '10px 14px', background: 'rgba(6, 182, 212, 0.06)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#22d3ee' }}>Config files written by installer:</strong>
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                        <code>.cursor/rules/nextrouter-commands.mdc</code> — Always-applied rule with MCP tool reference
                        <code>.cursor/mcp.json</code> — MCP server registration (nextrouter → npx tsx src/cli/mcp.ts)
                      </div>
                    </div>
                  </div>
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
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#34d399' }}>🌀 Antigravity — Gemini CLI MCP Integration</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 1 — Install the NextRouter Plugin</strong>
                      <p>Run the installer to register the MCP server and update GEMINI.md with tool usage instructions.</p>
                      <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#e2e8f0', marginTop: '8px', overflowX: 'auto' }}>{`npx tsx src/cli/index.ts install-plugin antigravity`}</pre>
                      <p style={{ marginTop: '8px', fontSize: '0.82rem' }}>This updates <code>GEMINI.md</code> with a rich NextRouter system context block and writes <code>~/.gemini/settings.json</code> with the MCP server entry.</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 2 — Restart the Antigravity / Gemini CLI Session</strong>
                      <p>Gemini CLI reads <code>~/.gemini/settings.json</code> at startup. Close and reopen your terminal session (or run <code>gemini</code> again) to pick up the new MCP server.</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Step 3 — Verify</strong>
                      <p>In your Gemini CLI session, ask: <em>&quot;What MCP tools do you have?&quot;</em> — you should see <code>get_shared_context</code>, <code>get_handover</code>, <code>sync_rules</code>, and others.</p>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>How It Works</strong>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li><strong>Session reading:</strong> NextRouter reads Antigravity&apos;s transcript logs from <code>~/.gemini/antigravity/brain/[session-id]/.system_generated/logs/transcript.jsonl</code>.</li>
                        <li><strong>Rules sync:</strong> NextRouter reads/writes <code>GEMINI.md</code> in your project root. Universal skills are injected on sync.</li>
                        <li><strong>GEMINI.md block:</strong> The installer adds a <code>NEXTROUTER_COMMANDS_START/END</code> block with proactive MCP tool usage instructions.</li>
                      </ul>
                    </div>
                    <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#34d399' }}>Config files written by installer:</strong>
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                        <code>GEMINI.md</code> — NextRouter commands block with proactive MCP tool instructions
                        <code>~/.gemini/settings.json</code> — MCP server registration (nextrouter → npx tsx src/cli/mcp.ts)
                      </div>
                    </div>
                  </div>
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
              <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)', marginBottom: '8px' }}>
                🔌 Provider Plugin Installation
              </h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                Install NextRouter as a native plugin in each AI provider. For Claude Code, this creates global slash commands (<code>/nr-sync</code>, <code>/nr-handover</code>, etc.) available in any project. For Cursor, it creates an MDC rule. For Copilot, it creates VS Code tasks.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pluginStatuses.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading plugin status...</div>
              ) : (
                pluginStatuses.map(plugin => (
                  <div key={plugin.providerId} style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: `1px solid ${plugin.installed ? plugin.color + '40' : 'var(--border-color)'}`,
                    background: plugin.installed ? plugin.color + '08' : 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: plugin.installed ? plugin.color : 'var(--text-dark)',
                          boxShadow: plugin.installed ? `0 0 8px ${plugin.color}` : 'none',
                          flexShrink: 0
                        }} />
                        <strong style={{ fontSize: '1rem', color: plugin.installed ? plugin.color : 'var(--text-main)' }}>
                          {plugin.providerName}
                        </strong>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: plugin.installed ? plugin.color + '20' : 'rgba(255,255,255,0.05)',
                          color: plugin.installed ? plugin.color : 'var(--text-muted)',
                          fontWeight: 700
                        }}>
                          {plugin.installed ? 'INSTALLED' : 'NOT INSTALLED'}
                        </span>
                      </div>
                      {plugin.installed && plugin.installedFiles.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {plugin.installedFiles.map(f => (
                            <code key={f} style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              ✓ {f}
                            </code>
                          ))}
                        </div>
                      )}
                      {pluginLogs[plugin.providerId]?.length > 0 && (
                        <div style={{
                          marginTop: '4px',
                          padding: '8px 12px',
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {pluginLogs[plugin.providerId].map((log, i) => (
                            <div key={i}>{log}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleInstallPlugin(plugin.providerId)}
                      disabled={installingPlugin === plugin.providerId}
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        flexShrink: 0,
                        background: plugin.installed ? 'rgba(255,255,255,0.03)' : 'var(--color-primary-glow)',
                        color: plugin.installed ? 'var(--text-muted)' : 'var(--color-primary)',
                        border: '1px solid',
                        borderColor: plugin.installed ? 'var(--border-color)' : 'var(--color-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {installingPlugin === plugin.providerId
                        ? 'Installing...'
                        : plugin.installed ? '↺ Reinstall' : '⚡ Install'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ background: 'rgba(139, 92, 246, 0.04)', border: '1px solid rgba(139, 92, 246, 0.12)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#a78bfa' }}>🐚 Claude Code Slash Commands</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                After installing the Claude Code plugin, these slash commands are available globally in any Claude Code session:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { cmd: '/nr-status', desc: 'Show active providers and sessions' },
                  { cmd: '/nr-sync', desc: 'Sync rules across .cursorrules, CLAUDE.md, GEMINI.md' },
                  { cmd: '/nr-handover [from] [to]', desc: 'Generate handover from latest session' },
                  { cmd: '/nr-tokens', desc: 'Show token usage vs context window limits' },
                  { cmd: '/nr-prune [file]', desc: 'Strip implementation bodies to save tokens' }
                ].map(({ cmd, desc }) => (
                  <div key={cmd} style={{ display: 'flex', gap: '12px', alignItems: 'baseline', fontSize: '0.85rem' }}>
                    <code style={{ color: '#a78bfa', minWidth: '240px', fontFamily: 'var(--font-mono)' }}>{cmd}</code>
                    <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>🖥️ Live CLI Terminal Demo</h3>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {(['status', 'sync', 'tokens', 'daemon'] as const).map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => setSelectedCliCommand(cmd)}
                    className="btn btn-secondary"
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: selectedCliCommand === cmd ? 'var(--color-primary-glow)' : 'transparent',
                      color: selectedCliCommand === cmd ? 'var(--color-primary)' : 'var(--text-muted)',
                      border: '1px solid',
                      borderColor: selectedCliCommand === cmd ? 'var(--color-primary)' : 'var(--border-color)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {mockCliOutputs[cmd].cmd}
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: '1.7', color: '#e2e8f0' }}>
                <div style={{ marginBottom: '6px', color: '#64748b' }}>$ {mockCliOutputs[selectedCliCommand].cmd}</div>
                {mockCliOutputs[selectedCliCommand].output}
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

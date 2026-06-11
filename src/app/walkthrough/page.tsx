'use client';

import React, { useState } from 'react';

export default function OnboardingWalkthroughPage() {
  const [activeStep, setActiveStep] = useState('mcp');
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);

  const steps = [
    { id: 'mcp', name: '1. MCP Setup', icon: '🔌' },
    { id: 'handoff', name: '2. Auto-Handoff', icon: '🔄' },
    { id: 'bridge', name: '3. Context Bridge', icon: '⚡' },
    { id: 'rules', name: '4. Rules Sync', icon: '⚙️' },
    { id: 'skills', name: '5. Universal Skills', icon: '🧩' }
  ];

  const mcpCommand = `npx tsx /Users/ramadhani.musthofa/Work/nextrouter/src/cli/mcp.ts`;
  const claudeCommand = `claude mcp add nextrouter npx tsx /Users/ramadhani.musthofa/Work/nextrouter/src/cli/mcp.ts`;

  function handleCopy(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              Exposing NextRouter as an MCP server allows Claude Code and Cursor to query your database, count tokens, sync rules, and automatically discover active sessions.
            </p>

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

      </div>

    </div>
  );
}

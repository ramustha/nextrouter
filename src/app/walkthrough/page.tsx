'use client';

import React, { useState, useEffect } from 'react';

export default function OnboardingWalkthroughPage() {
  const [activeGuideTab, setActiveGuideTab] = useState<string>('bridge');
  const [activeStep, setActiveStep] = useState('mcp');
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [copiedAntigravity, setCopiedAntigravity] = useState(false);
  const [activeProviderTab, setActiveProviderTab] = useState('claude');
  const [settingUp, setSettingUp] = useState(false);
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
  const [workspacePath, setWorkspacePath] = useState('');

  useEffect(() => {
    async function loadSystemStatus() {
      try {
        const res = await fetch('/api/system');
        if (res.ok) {
          const data = await res.json();
          if (data.workspacePath) {
            setWorkspacePath(data.workspacePath);
          }
        }
      } catch (e) {
        console.error('Failed to load system path:', e);
      }
    }
    loadSystemStatus();
  }, []);

  const resolvedPath = workspacePath || '[absolute-project-path]';
  const mcpPath = workspacePath ? `${workspacePath}/src/cli/mcp.ts` : '[absolute-project-path]/src/cli/mcp.ts';

  const mcpCommand = `npx tsx ${mcpPath}`;
  const claudeCommand = `claude mcp add nextrouter npx tsx ${mcpPath}`;
  const antigravityCommand = `node -e "const fs=require('fs'), path=require('path'), os=require('os'), p=path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'); fs.mkdirSync(path.dirname(p), {recursive:true}); const d=fs.existsSync(p)?JSON.parse(fs.readFileSync(p, 'utf8')):{}; d.mcpServers=d.mcpServers||{}; d.mcpServers.nextrouter={command:'npx', args:['tsx', '${workspacePath ? workspacePath.replace(/\\/g, '\\\\') : '[absolute-project-path]'}/src/cli/mcp.ts']}; fs.writeFileSync(p, JSON.stringify(d, null, 2));"`;

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

  function handleCopy(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (activeStep === 'mcp') {
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
        await loadPluginStatuses();
      } else {
        alert(`Setup failed: ${data.error || 'Unknown error'}\n\n${(data.logs || []).join('\n')}`);
      }
    } catch (e: any) {
      alert(`Setup error: ${e.message || e}`);
    } finally {
      setSettingUp(false);
    }
  }

  const steps = [
    { id: 'mcp', name: '1. Connect Assistants', icon: '🔌' },
    { id: 'handoff', name: '2. Context Bridge & Handoffs', icon: '🔄' },
    { id: 'rules', name: '3. Rules & Skills Sync', icon: '⚙️' }
  ];

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Onboarding Guide & Tutorials</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Learn how to get the most out of NextRouter context sharing, rules syncing, and prompt skills management
        </p>
      </div>

      {/* Revamped Interactive Feature Guide */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>📚</span>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)', background: 'linear-gradient(to right, #a78bfa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>How NextRouter Works — Interactive Guide</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0 0' }}>Click through the tabs below to explore the core architecture and features under the hood</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '4px' }}>
          {/* Left Side: Tabs List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '210px', flexShrink: 0 }}>
            {[
              { id: 'bridge', name: 'Context Bridge', icon: '🌉', color: '#8b5cf6', colorGlow: 'rgba(139, 92, 246, 0.1)' },
              { id: 'sync', name: 'Rules Sync', icon: '⚡', color: '#06b6d4', colorGlow: 'rgba(6, 182, 212, 0.1)' },
              { id: 'budget', name: 'Token Budget', icon: '📊', color: '#f59e0b', colorGlow: 'rgba(245, 158, 11, 0.1)' },
              { id: 'mcp', name: 'MCP Integration', icon: '🔌', color: '#a78bfa', colorGlow: 'rgba(167, 139, 250, 0.1)' },
              { id: 'setup', name: 'One-Click Setup', icon: '🎯', color: '#10b981', colorGlow: 'rgba(16, 185, 129, 0.1)' }
            ].map(tab => {
              const isActive = activeGuideTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveGuideTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: isActive ? tab.color : 'rgba(255, 255, 255, 0.04)',
                    background: isActive ? tab.colorGlow : 'rgba(255, 255, 255, 0.01)',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'var(--transition-smooth)',
                    boxShadow: isActive ? `0 4px 12px ${tab.color}15` : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = tab.color;
                      e.currentTarget.style.borderColor = `${tab.color}40`;
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{tab.icon}</span>
                    <span>{tab.name}</span>
                  </div>
                  {isActive && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: tab.color,
                      boxShadow: `0 0 8px ${tab.color}`
                    }} />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Right Side: Tab Visual Display Console */}
          <div style={{
            flex: 1,
            minWidth: '320px',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative background glow */}
            <div style={{
              position: 'absolute',
              top: '-40%',
              right: '-10%',
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              background: activeGuideTab === 'bridge' ? 'rgba(139, 92, 246, 0.08)' :
                          activeGuideTab === 'sync' ? 'rgba(6, 182, 212, 0.08)' :
                          activeGuideTab === 'budget' ? 'rgba(245, 158, 11, 0.08)' :
                          activeGuideTab === 'mcp' ? 'rgba(167, 139, 250, 0.08)' : 'rgba(16, 185, 129, 0.08)',
              filter: 'blur(35px)',
              pointerEvents: 'none'
            }} />

            {activeGuideTab === 'bridge' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ color: '#a78bfa', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span>🌉</span> Context Bridge & Session Handover
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    Transfer active coding sessions between Claude Code, Cursor, and other editors instantly. NextRouter extracts your conversation transcripts, active goals, and uncommitted changes into a unified markdown package, enabling the target assistant to pick up exactly where you left off.
                  </p>
                </div>

                {/* Flow diagram */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Data Flow:</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '16px 20px',
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '20px', padding: '6px 12px', fontSize: '0.78rem', color: '#a78bfa', boxShadow: '0 0 10px rgba(139,92,246,0.1)' }}>
                      <span>🐚</span> <span style={{ fontWeight: 600 }}>Claude Code</span>
                    </div>
                    <div style={{ display: 'flex', flex: 1, minWidth: '40px', height: '2px', background: 'linear-gradient(to right, #8b5cf6, #06b6d4)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '2px 8px', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>handover.md</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '20px', padding: '6px 12px', fontSize: '0.78rem', color: '#22d3ee', boxShadow: '0 0 10px rgba(6,182,212,0.1)' }}>
                      <span>🎯</span> <span style={{ fontWeight: 600 }}>Cursor</span>
                    </div>
                  </div>
                </div>

                {/* Console simulator */}
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
                  </div>
                  <div style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                    <div style={{ color: '#64748b' }}>$ nextrouter handover claude-code --target cursor</div>
                    <div style={{ color: '#34d399' }}>✓ Handover package successfully generated!</div>
                    <div style={{ color: '#60a5fa' }}>⚡ Injecting context briefing directly into Cursor database...</div>
                    <div style={{ color: '#10b981' }}>✓ Context successfully bridged! Cursor is ready to resume.</div>
                  </div>
                </div>
              </>
            )}

            {activeGuideTab === 'sync' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ color: '#22d3ee', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span>⚡</span> Rules & Active Plan Sync
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    Ensure prompt rules, plan lists, and custom skills remain perfectly synchronized. NextRouter's file watcher watches for changes in rules files or `skills/` and immediately syncs them bidirectionally across all active configuration files.
                  </p>
                </div>

                {/* Flow diagram */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Data Flow:</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '16px 20px',
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', color: '#fbbf24' }}>
                        <span>🎯</span> <code>plan.md</code>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', color: '#34d399' }}>
                        <span>🧩</span> <code>skills/</code>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flex: 1, minWidth: '40px', height: '2px', background: 'linear-gradient(to right, #fbbf24, #a78bfa)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '2px 8px', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Sync Engine</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <code>.cursorrules</code>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <code>CLAUDE.md</code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Console simulator */}
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
                  </div>
                  <div style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                    <div style={{ color: '#64748b' }}># rule changes detected in plan.md</div>
                    <div style={{ color: '#fbbf24' }}>[Watcher] File updated: plan.md</div>
                    <div style={{ color: '#a78bfa' }}>[Sync] Injecting active checklist items (4 complete, 1 remaining)</div>
                    <div style={{ color: '#34d399' }}>✓ Synced rules successfully to .cursorrules and CLAUDE.md!</div>
                  </div>
                </div>
              </>
            )}

            {activeGuideTab === 'budget' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ color: '#fbbf24', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span>📊</span> Context Window & Request Budgets
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    Prevent token waste and rate limits. NextRouter tracks token consumption relative to each provider's context window. If a session reaches **90%** of its capacity, NextRouter triggers a native OS desktop notification.
                  </p>
                </div>

                {/* Progress indicators simulator */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '16px 20px',
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 600 }}>Claude Code (Sonnet 3.5) Context Budget</span>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>91% Used</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '91%', background: 'linear-gradient(to right, #f59e0b, #ef4444)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>182,000 / 200,000 tokens consumed</span>
                  </div>
                </div>

                {/* Alert simulator */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '1.3rem' }}>🚨</span>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.82rem', color: '#f87171', fontWeight: 600 }}>High Context Alert (Claude Code)</h5>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'rgba(248, 113, 113, 0.8)' }}>
                      Active session has exceeded 90% of model window. Recommend context handoff.
                    </p>
                  </div>
                </div>
              </>
            )}

            {activeGuideTab === 'mcp' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ color: '#a78bfa', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span>🔌</span> Model Context Protocol (MCP) Standard
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    Expose NextRouter tools directly into your AI terminals and editors. By exposing standard tools like `get_shared_context`, `save_context`, and `get_active_plan`, AI assistants natively check for cross-provider active handovers on session boot.
                  </p>
                </div>

                {/* Visual flow chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Data Flow:</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '16px 20px',
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', color: 'var(--text-main)' }}>
                      <span>🐚</span> Claude Code CLI
                    </div>
                    <div style={{ display: 'flex', flex: 1, minWidth: '40px', height: '2px', background: 'linear-gradient(to right, #8b5cf6, #34d399)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '2px 8px', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>get_shared_context()</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', color: '#34d399' }}>
                      <span>🔌</span> MCP Server
                    </div>
                  </div>
                </div>

                {/* Console simulator */}
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
                  </div>
                  <div style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                    <div style={{ color: '#64748b' }}># Assistant calls nextrouter MCP server tool on first load</div>
                    <div style={{ color: '#a78bfa' }}>mcp.callTool("get_shared_context", {"{ workspacePath: \"~/Work/my-project\" }"})</div>
                    <div style={{ color: '#34d399' }}>→ Found active handover context from Cursor (Last active 3m ago, saved $0.42)</div>
                    <div style={{ color: '#cbd5e1' }}>🔄 Suggesting context resumption to user...</div>
                  </div>
                </div>
              </>
            )}

            {activeGuideTab === 'setup' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ color: '#10b981', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span>🎯</span> One-Click Setup & Environment Sync
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    Install the sync engine natively on your machine. Running setup registers NextRouter MCP servers globally in Claude Code and Cursor configurations, configures shell aliases, downloads SQLite binaries, and starts the rule sync watcher daemon.
                  </p>
                </div>

                {/* Visual flow chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Setup Chain:</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '16px 20px',
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', color: '#10b981' }}>
                      <span>🐚</span> Shell Profile Alias
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', color: '#22d3ee' }}>
                      <span>🔌</span> IDE Global MCPs
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', color: '#a78bfa' }}>
                      <span>🤖</span> Watcher Daemon
                    </div>
                  </div>
                </div>

                {/* Console simulator */}
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
                  </div>
                  <div style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                    <div style={{ color: '#64748b' }}>$ npm run setup</div>
                    <div style={{ color: '#34d399' }}>✓ Cursor global config updated (~/.cursor/mcp.json)</div>
                    <div style={{ color: '#34d399' }}>✓ Registered nextrouter shell alias inside shell profile</div>
                    <div style={{ color: '#34d399' }}>✓ Watcher daemon successfully spawned in background! (PID: 4892)</div>
                  </div>
                </div>
              </>
            )}
            
            {/* Visual tip footer */}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>💡 Tip: {activeGuideTab === 'bridge' ? 'Try automated injection by selecting a session!' :
                            activeGuideTab === 'sync' ? 'Rules sync runs automatically in the background via the Daemon.' :
                            activeGuideTab === 'budget' ? 'Watch budget bars under each provider on the right.' :
                            activeGuideTab === 'mcp' ? 'Connected assistants check this before calling server providers.' : 'Click "Local Setup" in Services on the right.'}</span>
            </div>
          </div>
        </div>
      </div>


      {/* Tabs navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '8px',
        overflowX: 'auto'
      }}>
        {steps.map(s => (
          <button 
            key={s.id}
            onClick={() => setActiveStep(s.id)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: activeStep === s.id ? 'var(--color-primary-glow)' : 'transparent',
              border: `1px solid ${activeStep === s.id ? 'var(--border-color-active)' : 'transparent'}`,
              color: activeStep === s.id ? 'var(--color-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: activeStep === s.id ? 600 : 500,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
      <div className="glass-panel" style={{ padding: '24px', minHeight: '400px' }}>
        
        {activeStep === 'mcp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--color-primary)' }}>🔌 Connecting AI Assistants</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              NextRouter exposes an MCP server and plugins to enable Claude Code, Cursor, Copilot, and Antigravity to sync rules, budgets, and handovers automatically.
            </p>

            {/* One-Click Setup Alert Card */}
            <div style={{ 
              background: 'rgba(139, 92, 246, 0.06)', 
              border: '1px solid var(--border-color-active)', 
              borderRadius: '12px', 
              padding: '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span>⚡</span> One-Click Auto Laptop Setup (Recommended)
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                  Automatically configures everything locally: registers MCP servers in Claude/Cursor/Antigravity, sets up command aliases, syncs rules/skills, and runs the sync daemon.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleOneClickSetup}
                disabled={settingUp}
                style={{
                  width: 'fit-content',
                  padding: '10px 20px',
                  background: 'linear-gradient(to right, #8b5cf6, #06b6d4)',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.25)'
                }}
              >
                {settingUp ? '⚙️ Automating Setup...' : '⚡ Configure Local Laptop Automatically'}
              </button>
            </div>

            {/* Plugin Status Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Active Assistant Plugins</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {pluginStatuses.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading plugin status...</div>
                ) : (
                  pluginStatuses.map(plugin => (
                    <div key={plugin.providerId} style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: `1px solid ${plugin.installed ? plugin.color + '30' : 'var(--border-color)'}`,
                      background: plugin.installed ? plugin.color + '05' : 'rgba(255,255,255,0.01)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: plugin.installed ? plugin.color : 'var(--text-dark)',
                            boxShadow: plugin.installed ? `0 0 6px ${plugin.color}` : 'none'
                          }} />
                          <strong style={{ fontSize: '0.9rem', color: plugin.installed ? plugin.color : 'var(--text-main)' }}>
                            {plugin.providerName}
                          </strong>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: plugin.installed ? 'var(--color-success)' : 'var(--text-muted)' }}>
                          {plugin.installed ? 'Installed' : 'Not configured'}
                        </span>
                      </div>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleInstallPlugin(plugin.providerId)}
                        disabled={installingPlugin === plugin.providerId}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          background: plugin.installed ? 'transparent' : 'var(--color-primary-glow)',
                          color: plugin.installed ? 'var(--text-muted)' : 'var(--color-primary)',
                          border: '1px solid',
                          borderColor: plugin.installed ? 'var(--border-color)' : 'var(--color-primary)',
                          cursor: 'pointer'
                        }}
                      >
                        {installingPlugin === plugin.providerId ? '⏳' : plugin.installed ? 'Reinstall' : 'Install'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Provider Integration Guides & Manual Configs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Manual Setup & Documentation</h3>
              
              {/* Sub-tabs for Providers */}
              <div style={{ 
                display: 'flex', 
                gap: '4px', 
                background: 'rgba(255, 255, 255, 0.02)', 
                padding: '4px', 
                borderRadius: '8px', 
                width: 'fit-content', 
                border: '1px solid var(--border-color)'
              }}>
                {[
                  { id: 'claude', name: 'Claude Code', color: '#8b5cf6' },
                  { id: 'cursor', name: 'Cursor', color: '#06b6d4' },
                  { id: 'antigravity', name: 'Antigravity', color: '#f59e0b' },
                  { id: 'copilot', name: 'GitHub Copilot', color: '#10b981' },
                  { id: 'gemini', name: 'Gemini / Google AI', color: '#4285f4' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActiveProviderTab(p.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeProviderTab === p.id ? p.color : 'transparent',
                      color: activeProviderTab === p.id ? '#ffffff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* Dynamic Sub-tab content */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                {/* Claude Code Details */}
                {activeProviderTab === 'claude' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Run this command inside your terminal:</span>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        background: 'rgba(0, 0, 0, 0.3)', 
                        padding: '10px 14px', 
                        borderRadius: '6px', 
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.78rem',
                        border: '1px solid var(--border-color)'
                      }}>
                        <span style={{ flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>{claudeCommand}</span>
                        <button className="btn btn-secondary" onClick={() => handleCopy(claudeCommand, setCopiedClaude)} style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                          {copiedClaude ? '✅' : '📋 Copy'}
                        </button>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <h4 style={{ fontSize: '#a78bfa', color: '#a78bfa', marginBottom: '8px' }}>Active Integration Features:</h4>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        <li><strong>Rule Synchronization:</strong> NextRouter updates `CLAUDE.md` in your project root, injecting rules and workspace plan files automatically.</li>
                        <li><strong>Global Slash Commands:</strong> Once installed, commands like `/nr-status`, `/nr-sync`, `/nr-tokens`, `/nr-prune`, and `/nr-handover` are registered globally inside Claude Code.</li>
                        <li><strong>Context Monitoring:</strong> Automatically parses `~/.claude.json` and session logs to reconstruct active history.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Cursor Details */}
                {activeProviderTab === 'cursor' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure MCP server inside Cursor settings:</span>
                      <ol style={{ paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <li>Navigate to <strong>Cursor Settings</strong> → <strong>Features</strong> → <strong>MCP</strong>.</li>
                        <li>Click <strong>+ Add New MCP Server</strong>: set Name to <code>NextRouter</code>, Type to <code>command</code>.</li>
                        <li>Paste this command in the Command box:</li>
                      </ol>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        background: 'rgba(0, 0, 0, 0.3)', 
                        padding: '10px 14px', 
                        borderRadius: '6px', 
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.78rem',
                        border: '1px solid var(--border-color)',
                        marginTop: '4px'
                      }}>
                        <span style={{ flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>{mcpCommand}</span>
                        <button className="btn btn-secondary" onClick={() => handleCopy(mcpCommand, setCopiedMcp)} style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                          {copiedMcp ? '✅' : '📋 Copy'}
                        </button>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <h4 style={{ color: '#22d3ee', marginBottom: '8px' }}>Active Integration Features:</h4>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        <li><strong>Always-Applied MDC Rules:</strong> Automatically installs `.cursor/rules/nextrouter-commands.mdc` to guide Cursor on using MCP tools dynamically.</li>
                        <li><strong>SQLite Log Extraction:</strong> Indexes Cursor SQLite `store.db` chats from `~/.cursor/chats/` to monitor context sizes and project-scoped details.</li>
                        <li><strong>Rules Injection:</strong> Synchronizes coding rules, custom skills, and plans to `.cursorrules` in your project root.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Antigravity Details */}
                {activeProviderTab === 'antigravity' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        Configure Antigravity global settings by running this built-in Node command in your terminal:
                      </span>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        background: 'rgba(0, 0, 0, 0.3)', 
                        padding: '10px 14px', 
                        borderRadius: '6px', 
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.78rem',
                        border: '1px solid var(--border-color)',
                        marginTop: '4px'
                      }}>
                        <span style={{ flex: 1, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{antigravityCommand}</span>
                        <button className="btn btn-secondary" onClick={() => handleCopy(antigravityCommand, setCopiedAntigravity)} style={{ padding: '4px 10px', fontSize: '0.72rem', alignSelf: 'flex-start' }}>
                          {copiedAntigravity ? '✅' : '📋 Copy'}
                        </button>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <h4 style={{ color: 'var(--color-success)', marginBottom: '8px' }}>Active Integration Features:</h4>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        <li><strong>Rules Integration:</strong> Synchronizes global prompt rules and custom skills into `GEMINI.md` in your project root.</li>
                        <li><strong>Transcript Parsing:</strong> Parses transcript JSONL files to reconstruct conversation logs and token statistics.</li>
                        <li><strong>Automatic Settings Injection:</strong> Registers NextRouter to `~/.gemini/settings.json` so the Gemini CLI can communicate natively.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Copilot Details */}
                {activeProviderTab === 'copilot' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.2s ease-out' }}>
                    <h4 style={{ color: '#34d399' }}>Copilot Chat Handover Guides</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      Copilot Chat inside VS Code reads configuration rules from <code>.github/copilot-instructions.md</code>.
                    </p>
                    <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                      <li><strong>Custom Instructions:</strong> NextRouter updates <code>.github/copilot-instructions.md</code> to synchronize prompt rules and universal skills.</li>
                      <li><strong>Manual Handovers:</strong> Since Copilot doesn't expose a session database, use the **Context Bridge** tab to generate briefing packages, copy the markdown, and paste it into the Copilot chat window.</li>
                    </ul>
                  </div>
                )}

                {/* Gemini Details */}
                {activeProviderTab === 'gemini' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.2s ease-out' }}>
                    <h4 style={{ color: '#669df6' }}>Gemini / Google AI Setup</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      Gemini integrates rules via project-level Markdown files and tool definitions:
                    </p>
                    <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                      <li><strong>Rules File:</strong> NextRouter automatically synchronizes global prompt rules and custom skills into <code>GEMINI.md</code> in your project root.</li>
                      <li><strong>Prompt Injection:</strong> Prepend the content of <code>GEMINI.md</code> as system instructions in your Gemini API requests.</li>
                      <li><strong>MCP Client Integration:</strong> Register NextRouter's stdio transport command (<code>{mcpCommand}</code>) inside your Gemini SDK runner or client.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeStep === 'handoff' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--color-primary)' }}>🔄 Context Bridge & Automated Handoffs</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              NextRouter allows you to bridge conversational history, modified files, uncommitted git diffs, and project plans across AI assistants.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {/* Option A: Auto-Handoff */}
              <div style={{ background: 'rgba(139, 92, 246, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#a78bfa' }}>🤖 Option A: Automated MCP Handoff</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  NextRouter injects a shared context check protocol into your rule files. At the start of a session, the assistant will automatically scan the workspace.
                </p>
                <div style={{ 
                  marginTop: '6px', 
                  padding: '12px', 
                  background: 'rgba(0, 0, 0, 0.25)', 
                  borderRadius: '6px', 
                  borderLeft: '3px solid var(--color-primary)',
                  fontSize: '0.8rem',
                  color: 'var(--text-main)'
                }}>
                  🔄 <strong>NextRouter Context Handoff Detected</strong><br/>
                  I detected an active session from <strong>Claude Code</strong> on task: <em>"Refactor authentication"</em>. Would you like me to pull the context?
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Simply reply <strong>"yes"</strong> to load the context packet and resume work seamlessly!
                </p>
              </div>

              {/* Option B: Manual Context Bridge */}
              <div style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#22d3ee' }}>⚡ Option B: Manual Context Bridge</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  If a provider doesn't support MCP (like Copilot Chat) or you want to copy the briefing manually:
                </p>
                <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <li>Go to the <strong>Context Bridge</strong> tab on the Dashboard.</li>
                  <li>Select the source session, target provider, and mode (Briefing / Original).</li>
                  <li>Click <strong>Generate Handover Packet</strong>, copy the compiled markdown briefing, and paste it directly into your new assistant chat window.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeStep === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--color-primary)' }}>⚙️ Rules & Universal Skills Synchronization</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Keep prompt configurations, coding standards, and active plans synchronized across all active providers in your workspace.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Bidirectional Rules Sync */}
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '1.1rem' }}>🔄 Bidirectional Rules Sync</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Edit rules in one place and let NextRouter propagate them. Updates to `CLAUDE.md`, `.cursorrules`, or `GEMINI.md` automatically sync across all other provider formats.
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Run <code>npm run cli sync</code> or click **Push & Sync** on the Rules & Skills page to trigger.
                </p>
              </div>

              {/* Universal Skills */}
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '1.1rem' }}>🧩 Universal Prompt Skills</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Write custom markdown coding guidelines inside the <code>skills/</code> folder. Adding a YAML frontmatter with `auto_inject: true` automatically appends them to all rules configurations.
                </p>
              </div>

              {/* Active Plan Sync */}
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '1.1rem' }}>🎯 Plan & Checklist Integration</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  If plan files (like <code>plan.md</code>, <code>task.md</code>, or superpower plugin plans under <code>**/plans/*.md</code>) exist, NextRouter extracts remaining/completed checklist items from the most recently modified plan and appends them to system instructions.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

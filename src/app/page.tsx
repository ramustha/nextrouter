'use client';

import React, { useEffect, useState } from 'react';

interface Provider {
  id: string;
  name: string;
  status: string;
  workspace_path?: string;
  last_scanned_at?: string;
}

interface ContextMetrics {
  totalWorkspaceTokens: number;
  providers: Record<string, {
    totalTokens: number;
    totalFiles: number;
    budgetUsedPercent: number;
  }>;
}

interface Session {
  id: string;
  provider_id: string;
  title: string;
  started_at: string;
  last_active_at: string;
  status: string;
  token_count: number;
  messages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    tokens?: number;
  }>;
  workspace_path?: string;
}

interface CostAnalytics {
  totalTokens: number;
  totalCost: number;
  breakdown: Array<{
    providerId: string;
    providerName: string;
    tokens: number;
    cost: number;
  }>;
}

interface SystemStatus {
  workspacePath: string;
  watcher: { running: boolean };
  daemon: { running: boolean; pid: number | null; activeAIProcesses: string[] };
  mcp: { configuredInClaude: boolean; configuredInCursor: boolean };
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [metrics, setMetrics] = useState<ContextMetrics | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics>({ totalTokens: 0, totalCost: 0, breakdown: [] });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [workspacePath, setWorkspacePath] = useState('');
  const [gitBranch, setGitBranch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [togglingDaemon, setTogglingDaemon] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  // Session details & handover states
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [handoverBriefing, setHandoverBriefing] = useState<string>('');
  const [loadingBriefing, setLoadingBriefing] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'conversation' | 'handover'>('conversation');
  const [copiedBriefing, setCopiedBriefing] = useState<boolean>(false);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [bridgeTargetProvider, setBridgeTargetProvider] = useState<string>('');
  const [injecting, setInjecting] = useState<boolean>(false);
  const [injected, setInjected] = useState<boolean>(false);

  async function loadData() {
    try {
      const pRes = await fetch(`/api/providers?workspacePath=${encodeURIComponent(workspacePath)}`);
      if (pRes.ok) setProviders(await pRes.json());

      const mRes = await fetch(`/api/context?workspacePath=${encodeURIComponent(workspacePath)}`);
      if (mRes.ok) setMetrics(await mRes.json());

      const sRes = await fetch(`/api/sessions?workspacePath=${encodeURIComponent(workspacePath)}`);
      if (sRes.ok) setSessions(await sRes.json());

      const cRes = await fetch('/api/tokens/usage');
      if (cRes.ok) setCostAnalytics(await cRes.json());

      const sysRes = await fetch('/api/system');
      if (sysRes.ok) {
        const sysData = await sysRes.json();
        setSystemStatus(sysData);
        if (sysData.workspacePath && !workspacePath) {
          setWorkspacePath(sysData.workspacePath);
        }
      }

      const gitRes = await fetch(`/api/git?workspacePath=${encodeURIComponent(workspacePath)}`);
      if (gitRes.ok) {
        const gitData = await gitRes.json();
        if (gitData.isRepository) {
          setGitBranch(gitData.branch);
        } else {
          setGitBranch('');
        }
      }
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
  }

  useEffect(() => {
    loadData();
    
    // Poll system and provider statuses every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [workspacePath]);

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch('/api/providers/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath })
      });
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error('Scan failed:', e);
    } finally {
      setScanning(false);
    }
  }

  async function handleSyncRules() {
    setSyncing(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', workspacePath })
      });
      if (res.ok) {
        alert('Rules synced successfully across all providers!');
        await loadData();
      }
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggleDaemon() {
    if (!systemStatus) return;
    setTogglingDaemon(true);
    const action = systemStatus.daemon.running ? 'stop' : 'start';
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'daemon', action })
      });
      if (res.ok) {
        // Wait 1.5 seconds for daemon process modification and reload
        setTimeout(async () => {
          const sysRes = await fetch('/api/system');
          if (sysRes.ok) setSystemStatus(await sysRes.json());
          setTogglingDaemon(false);
        }, 1500);
      } else {
        setTogglingDaemon(false);
      }
    } catch (e) {
      console.error('Failed to toggle daemon:', e);
      setTogglingDaemon(false);
    }
  }

  async function handleOneClickSetup() {
    setSettingUp(true);
    try {
      const res = await fetch('/api/system/setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Setup completed successfully!\n\n${data.logs.join('\n')}`);
        await loadData();
      } else {
        alert(`Setup failed: ${data.error || 'Unknown error'}\n\n${(data.logs || []).join('\n')}`);
      }
    } catch (e: any) {
      alert(`Setup error: ${e.message || e}`);
    } finally {
      setSettingUp(false);
    }
  }

  async function handleOpenSessionDetails(session: Session) {
    setSelectedSession(session);
    setModalTab('conversation');
    setHandoverBriefing('');
    setLoadingBriefing(true);
    setCopiedBriefing(false);
    setBridgeTargetProvider('');
    setInjected(false);

    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'handover',
          sourceProviderId: session.provider_id,
          sessionId: session.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        setHandoverBriefing(data.rawMarkdown || 'No handover data generated.');
      } else {
        setHandoverBriefing('Failed to compile handover briefing from server.');
      }
    } catch (e) {
      console.error('Error generating handover briefing:', e);
      setHandoverBriefing('Error generating handover briefing.');
    } finally {
      setLoadingBriefing(false);
    }
  }

  function handleCopyBriefing() {
    if (!handoverBriefing) return;
    navigator.clipboard.writeText(handoverBriefing);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 2000);
  }

  async function handleInjectToProvider() {
    if (!bridgeTargetProvider || !handoverBriefing || !selectedSession) return;
    setInjecting(true);
    setInjected(false);
    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          providerId: bridgeTargetProvider,
          title: `[Bridged from ${selectedSession.provider_id}] ${selectedSession.title}`,
          messages: [
            { role: 'system', content: handoverBriefing }
          ]
        })
      });
      if (res.ok) {
        setInjected(true);
        setTimeout(() => setInjected(false), 3000);
      }
    } catch (e) {
      console.error('Inject failed:', e);
    } finally {
      setInjecting(false);
    }
  }

  const activeProviderCount = providers.filter(p => p.status === 'active').length;
  const totalTokensUsed = metrics?.totalWorkspaceTokens || 0;

  // Budget progress calculations for combined active provider limit
  const activeLimit = metrics ? Object.values(metrics.providers).reduce((sum: number, p: any) => sum + (p.contextWindowLimit || 0), 0) : 200000;
  const totalBudgetPercent = activeLimit > 0 ? Math.min(100, Math.round((totalTokensUsed / activeLimit) * 100)) : 0;

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Workspace Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
              Monitor and coordinate context usage across your coding assistants
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <span>📂</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                {workspacePath ? workspacePath.replace(/^\/Users\/[^\/]+/, '~') : 'No workspace selected'}
              </span>
            </div>

            {gitBranch && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                color: '#a78bfa'
              }}>
                <span>🌿</span>
                <span style={{ fontWeight: 600 }}>{gitBranch}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleScan} disabled={scanning}>
            {scanning ? 'Scanning...' : '🔄 Scan Workspace'}
          </button>
          <button className="btn btn-primary" onClick={handleSyncRules} disabled={syncing}>
            {syncing ? 'Syncing...' : '⚡ Sync Rules'}
          </button>
        </div>
      </div>

      {/* Overview Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px'
      }}>
        
        {/* Card 1: Active Providers */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'var(--color-primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            color: 'var(--color-primary)'
          }}>
            🔌
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Providers</p>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>
              {activeProviderCount} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {providers.length}</span>
            </h3>
          </div>
        </div>

        {/* Card 2: Accrued Cost */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'rgba(6, 182, 212, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            color: 'var(--color-secondary)'
          }}>
            💲
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accrued Session Cost</p>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>
              ${costAnalytics.totalCost.toFixed(2)} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>USD</span>
            </h3>
          </div>
        </div>

        {/* Card 3: Token usage */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            color: 'var(--color-success)'
          }}>
            🪙
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shared Context Pool</p>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>
              {totalTokensUsed.toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>tokens</span>
            </h3>
          </div>
        </div>

      </div>

      {/* Main Grid: Budget Ring + Active Sessions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '340px 1fr',
        gap: '32px',
        alignItems: 'start'
      }}>
        
        {/* Left Side: Budget Health & Costs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Budget ring */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', alignSelf: 'flex-start' }}>Overall Context Budget</h3>
            
            <div className="gauge-container">
              <svg width="160" height="160" className="gauge-svg">
                <circle cx="80" cy="80" r="70" className="gauge-bg" />
                <circle cx="80" cy="80" r="70" className="gauge-fill" style={{
                  strokeDashoffset: 440 - (440 * totalBudgetPercent) / 100
                }} />
              </svg>
              <div className="gauge-text">
                <span style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{totalBudgetPercent}%</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>Used</span>
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Context Limit:</span>
                <span style={{ fontWeight: 600 }}>{activeLimit.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Accumulated:</span>
                <span style={{ fontWeight: 600 }}>{totalTokensUsed.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remaining:</span>
                <span style={{ fontWeight: 600, color: totalBudgetPercent > 90 ? 'var(--color-danger)' : 'var(--text-main)' }}>
                  {Math.max(0, activeLimit - totalTokensUsed).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Individual Provider Context Windows */}
            {metrics && metrics.providers && Object.keys(metrics.providers).length > 0 && (
              <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Provider Context Windows
                </h4>
                {Object.entries(metrics.providers).map(([providerId, data]: [string, any]) => {
                  let name = providerId;
                  let color = 'var(--text-main)';
                  let limit = data.contextWindowLimit || 128000;
                  
                  if (providerId === 'claude-code') {
                    name = 'Claude Code';
                    color = '#a78bfa';
                  } else if (providerId === 'cursor') {
                    name = 'Cursor';
                    color = 'var(--color-secondary)';
                  } else if (providerId === 'antigravity') {
                    name = 'Antigravity';
                    color = 'var(--color-success)';
                  } else if (providerId === 'copilot') {
                    name = 'GitHub Copilot';
                    color = 'var(--color-warning)';
                  }

                  if (limit === 0) return null;

                  const percent = Math.min(100, Math.round((data.totalTokens / limit) * 100));

                  return (
                    <div key={providerId} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, color }}>{name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {data.totalTokens.toLocaleString()} / <strong style={{ color: 'var(--text-main)' }}>{limit.toLocaleString()}</strong>
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: color,
                          boxShadow: `0 0 8px ${color}`,
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cost breakdown panel */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.15rem' }}>Estimated Cost Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {costAnalytics.breakdown.map((b) => (
                <div key={b.providerId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{b.providerName}</span>
                  <span style={{ fontWeight: 600 }}>${b.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Services Control Center */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚙️ Services Control Center
            </h3>
            
            {systemStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
                
                {/* 1. Daemon Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: systemStatus.daemon.running ? 'var(--color-success)' : 'var(--text-dark)',
                        boxShadow: systemStatus.daemon.running ? '0 0 8px var(--color-success)' : 'none'
                      }} />
                      <span style={{ fontWeight: 600 }}>Sync Daemon</span>
                    </div>
                    <button 
                      className="btn" 
                      onClick={handleToggleDaemon}
                      disabled={togglingDaemon}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '0.75rem',
                        background: systemStatus.daemon.running ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-primary-glow)',
                        color: systemStatus.daemon.running ? 'var(--color-danger)' : 'var(--color-primary)',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      {togglingDaemon ? 'Toggling...' : systemStatus.daemon.running ? 'Stop Daemon' : 'Start Daemon'}
                    </button>
                  </div>
                  
                  {systemStatus.daemon.running && systemStatus.daemon.pid && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>PID: <code>{systemStatus.daemon.pid}</code></span>
                      <span>
                        Active Editors: {systemStatus.daemon.activeAIProcesses.length > 0 
                          ? <strong style={{ color: 'var(--color-success)' }}>{systemStatus.daemon.activeAIProcesses.join(', ')}</strong> 
                          : 'None detected (waiting)'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. File Watcher Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <span style={{ fontWeight: 600 }}>Web Dev Watcher</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: systemStatus.watcher.running ? 'var(--color-success)' : 'var(--text-dark)',
                      boxShadow: systemStatus.watcher.running ? '0 0 8px var(--color-success)' : 'none'
                    }} />
                    <span style={{ color: systemStatus.watcher.running ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 500 }}>
                      {systemStatus.watcher.running ? 'Running' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* 3. MCP Configurations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: 600 }}>MCP Integrations</span>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Claude Code config:</span>
                    <span style={{ 
                      color: systemStatus.mcp.configuredInClaude ? 'var(--color-success)' : 'var(--text-muted)',
                      fontWeight: 600 
                    }}>
                      {systemStatus.mcp.configuredInClaude ? 'Configured ✓' : 'Not setup'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Cursor Feature MCP:</span>
                    <span style={{ 
                      color: systemStatus.mcp.configuredInCursor ? 'var(--color-success)' : 'var(--text-muted)',
                      fontWeight: 600 
                    }}>
                      {systemStatus.mcp.configuredInCursor ? 'Configured ✓' : 'Not setup'}
                    </span>
                  </div>
                </div>

                {/* One-Click Setup Button */}
                <button
                  className="btn btn-primary"
                  onClick={handleOneClickSetup}
                  disabled={settingUp}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    background: 'linear-gradient(to right, #8b5cf6, #06b6d4)',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
                  }}
                >
                  {settingUp ? '⚡ Configuring Local Environment...' : '⚡ One-Click Local Setup & Sync'}
                </button>

              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading system services status...</div>
            )}
          </div>

        </div>

        {/* Right Side: Timeline Sessions */}
        <div className="glass-panel" style={{ padding: '24px', minHeight: '480px' }}>
          {sessions.length === 0 ? (
            <>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '20px' }}>Recent Handovers & Conversations</h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '320px',
                color: 'var(--text-muted)',
                gap: '12px'
              }}>
                <span style={{ fontSize: '2.5rem' }}>📭</span>
                <p>No active sessions scanned in workspace yet.</p>
                <button className="btn btn-secondary" onClick={handleScan} style={{ marginTop: '8px' }}>
                  Run workspace scan
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.15rem' }}>Recent Handovers & Conversations</h3>
              </div>

              {/* Provider Filter Tabs */}
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap',
                gap: '8px', 
                borderBottom: '1px solid var(--border-color)', 
                paddingBottom: '14px'
              }}>
                {[
                  { id: 'all', name: 'All Providers', color: 'var(--color-primary)', bg: 'var(--color-primary-glow)' },
                  { id: 'cursor', name: 'Cursor', color: 'var(--color-secondary)', bg: 'rgba(6, 182, 212, 0.15)' },
                  { id: 'claude-code', name: 'Claude Code', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.15)' },
                  { id: 'antigravity', name: 'Antigravity', color: 'var(--color-success)', bg: 'rgba(16, 185, 129, 0.15)' },
                  { id: 'copilot', name: 'GitHub Copilot', color: 'var(--color-warning)', bg: 'rgba(245, 158, 11, 0.15)' }
                ].map(tab => {
                  const isActive = filterProvider === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setFilterProvider(tab.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid',
                        background: isActive ? tab.bg : 'transparent',
                        color: isActive ? tab.color : 'var(--text-muted)',
                        borderColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          e.currentTarget.style.color = tab.color;
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.borderColor = 'transparent';
                        }
                      }}
                    >
                      {tab.name}
                    </button>
                  );
                })}
              </div>

              {/* Session Timeline Items */}
              {(() => {
                const filtered = sessions.filter(s => filterProvider === 'all' || s.provider_id === filterProvider);
                if (filtered.length === 0) {
                  const activeTabName = [
                    { id: 'all', name: 'All Providers' },
                    { id: 'cursor', name: 'Cursor' },
                    { id: 'claude-code', name: 'Claude Code' },
                    { id: 'antigravity', name: 'Antigravity' },
                    { id: 'copilot', name: 'GitHub Copilot' }
                  ].find(t => t.id === filterProvider)?.name || filterProvider;
                  
                  return (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '240px',
                      color: 'var(--text-muted)',
                      gap: '12px'
                    }}>
                      <span style={{ fontSize: '2rem' }}>🔍</span>
                      <p>No sessions found for {activeTabName}.</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filtered.slice(0, 10).map((session) => {
                      let providerBg = 'rgba(255, 255, 255, 0.05)';
                      let providerColor = 'var(--text-muted)';
                      let providerLabel = session.provider_id;

                      if (session.provider_id === 'claude-code') {
                        providerBg = 'rgba(139, 92, 246, 0.15)';
                        providerColor = '#a78bfa';
                        providerLabel = 'Claude Code';
                      } else if (session.provider_id === 'cursor') {
                        providerBg = 'rgba(6, 182, 212, 0.15)';
                        providerColor = 'var(--color-secondary)';
                        providerLabel = 'Cursor';
                      } else if (session.provider_id === 'antigravity') {
                        providerBg = 'rgba(16, 185, 129, 0.15)';
                        providerColor = 'var(--color-success)';
                        providerLabel = 'Antigravity';
                      } else if (session.provider_id === 'copilot') {
                        providerBg = 'rgba(245, 158, 11, 0.15)';
                        providerColor = 'var(--color-warning)';
                        providerLabel = 'Copilot';
                      }

                      return (
                        <div key={session.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '16px',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          transition: 'var(--transition-smooth)',
                          cursor: 'pointer'
                        }} className="session-item-hover" onClick={() => handleOpenSessionDetails(session)}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                background: providerBg,
                                color: providerColor
                              }}>
                                {providerLabel}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {new Date(session.last_active_at).toLocaleDateString()} at {new Date(session.last_active_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{session.title}</h4>
                            {session.workspace_path && (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                fontSize: '0.75rem', 
                                color: 'var(--text-muted)',
                                opacity: 0.8,
                                marginTop: '2px'
                              }}>
                                <span>📁</span>
                                <code style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem' }}>
                                  {session.workspace_path.replace(/^\/Users\/[^\/]+/, '~')}
                                </code>
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{session.token_count.toLocaleString()}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>tokens</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

      </div>

      {/* Session Details Modal Overlay */}
      {selectedSession && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 7, 18, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setSelectedSession(null)}>
          <div style={{
            width: '100%',
            maxWidth: '900px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color-active)',
            boxShadow: 'var(--shadow-premium), var(--shadow-glow)',
            borderRadius: '20px',
            overflow: 'hidden',
            animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              background: 'rgba(255, 255, 255, 0.01)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {(() => {
                    let providerBg = 'rgba(255, 255, 255, 0.05)';
                    let providerColor = 'var(--text-muted)';
                    let providerLabel = selectedSession.provider_id;

                    if (selectedSession.provider_id === 'claude-code') {
                      providerBg = 'rgba(139, 92, 246, 0.2)';
                      providerColor = '#a78bfa';
                      providerLabel = 'Claude Code';
                    } else if (selectedSession.provider_id === 'cursor') {
                      providerBg = 'rgba(6, 182, 212, 0.2)';
                      providerColor = 'var(--color-secondary)';
                      providerLabel = 'Cursor';
                    } else if (selectedSession.provider_id === 'antigravity') {
                      providerBg = 'rgba(16, 185, 129, 0.2)';
                      providerColor = 'var(--color-success)';
                      providerLabel = 'Antigravity';
                    } else if (selectedSession.provider_id === 'copilot') {
                      providerBg = 'rgba(245, 158, 11, 0.2)';
                      providerColor = 'var(--color-warning)';
                      providerLabel = 'Copilot';
                    }

                    return (
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: providerBg,
                        color: providerColor,
                        letterSpacing: '0.05em'
                      }}>
                        {providerLabel}
                      </span>
                    );
                  })()}
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)'
                  }}>
                    {selectedSession.token_count.toLocaleString()} tokens
                  </span>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: selectedSession.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: selectedSession.status === 'active' ? 'var(--color-success)' : 'var(--text-muted)'
                  }}>
                    {selectedSession.status}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  {selectedSession.title}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Session ID: <code style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)' }}>{selectedSession.id}</code> &bull; Started: {new Date(selectedSession.started_at).toLocaleString()}
                  {selectedSession.workspace_path && (
                    <>
                      &nbsp;&bull;&nbsp;Workspace: <code style={{ color: '#c084fc', fontFamily: 'var(--font-mono)' }}>{selectedSession.workspace_path.replace(/^\/Users\/[^\/]+/, '~')}</code>
                    </>
                  )}
                </p>
              </div>
              <button 
                onClick={() => setSelectedSession(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'var(--transition-smooth)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                  e.currentTarget.style.color = 'var(--color-danger)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                ✕
              </button>
            </div>

            {/* Tabs Selector */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '0 24px'
            }}>
              <button
                onClick={() => setModalTab('conversation')}
                style={{
                  padding: '16px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: modalTab === 'conversation' ? '3px solid var(--color-primary)' : '3px solid transparent',
                  color: modalTab === 'conversation' ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                💬 Conversation History ({selectedSession.messages?.length || 0})
              </button>
              <button
                onClick={() => setModalTab('handover')}
                style={{
                  padding: '16px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: modalTab === 'handover' ? '3px solid var(--color-primary)' : '3px solid transparent',
                  color: modalTab === 'handover' ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                🔄 Handover Briefing
              </button>
            </div>

            {/* Modal Content Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              background: 'rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {modalTab === 'conversation' ? (
                /* Tab 1: Conversation History */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {!selectedSession.messages || selectedSession.messages.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem'
                    }}>
                      No messages recorded in this session.
                    </div>
                  ) : (
                    selectedSession.messages.map((msg, index) => {
                      const isUser = msg.role === 'user';
                      const isSystem = msg.role === 'system';
                      
                      if (isSystem) {
                        return (
                          <div key={index} style={{
                            alignSelf: 'center',
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '6px 16px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                            border: '1px solid var(--border-color)'
                          }}>
                            {msg.content}
                          </div>
                        );
                      }
                      
                      return (
                        <div key={index} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignSelf: isUser ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          gap: '6px'
                        }}>
                          {/* Message bubble */}
                          <div style={{
                            padding: '16px 20px',
                            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: isUser 
                              ? 'linear-gradient(135deg, var(--color-primary) 0%, #6d28d9 100%)' 
                              : 'rgba(255, 255, 255, 0.03)',
                            border: isUser ? 'none' : '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            boxShadow: isUser ? '0 4px 15px rgba(139, 92, 246, 0.2)' : 'none'
                          }}>
                            {msg.content}
                          </div>
                          
                          {/* Message sender & time */}
                          <div style={{
                            display: 'flex',
                            justifyContent: isUser ? 'flex-end' : 'flex-start',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            padding: '0 4px'
                          }}>
                            <span style={{ fontWeight: 600 }}>
                              {isUser 
                                ? 'You' 
                                : selectedSession.provider_id === 'claude-code' 
                                  ? 'Claude' 
                                  : selectedSession.provider_id === 'antigravity' 
                                    ? 'Antigravity' 
                                    : selectedSession.provider_id === 'cursor' 
                                      ? 'Cursor' 
                                      : selectedSession.provider_id === 'copilot'
                                        ? 'Copilot'
                                        : 'Assistant'}
                            </span>
                            {msg.timestamp && (
                              <span>
                                &bull; {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {msg.tokens && (
                              <span style={{ opacity: 0.8 }}>
                                &bull; {msg.tokens.toLocaleString()} tokens
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Tab 2: Handover Briefing */
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
                  {loadingBriefing ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '80px 0',
                      gap: '12px',
                      color: 'var(--text-muted)'
                    }}>
                      <div className="spinner" style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: '3px solid rgba(255, 255, 255, 0.1)',
                        borderTopColor: 'var(--color-primary)',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <span>Compiling context & generating briefing...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Copy this briefing to resume session cleanly in another assistant:
                        </span>
                        <button 
                          className="btn btn-primary" 
                          onClick={handleCopyBriefing}
                          disabled={!handoverBriefing}
                          style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                        >
                          {copiedBriefing ? '✓ Copied Briefing!' : '📋 Copy Briefing'}
                        </button>
                      </div>
                      
                      <textarea
                        readOnly
                        value={handoverBriefing}
                        style={{
                          flex: 1,
                          minHeight: '280px',
                          padding: '16px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          color: '#e5e7eb',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.85rem',
                          lineHeight: '1.5',
                          resize: 'none',
                          outline: 'none',
                          scrollbarWidth: 'thin'
                        }}
                      />
                      {/* Target Provider Bridge */}
                      <div style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          ⚡ Bridge to Another Provider
                        </h4>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <select
                            value={bridgeTargetProvider}
                            onChange={(e) => setBridgeTargetProvider(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              background: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              color: 'var(--text-main)',
                              fontSize: '0.85rem'
                            }}
                          >
                            <option value="">Select target provider...</option>
                            {[
                              { id: 'claude-code', name: 'Claude Code' },
                              { id: 'cursor', name: 'Cursor' },
                              { id: 'antigravity', name: 'Antigravity' },
                              { id: 'copilot', name: 'GitHub Copilot' }
                            ]
                              .filter(p => p.id !== selectedSession?.provider_id)
                              .map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                          </select>
                          <button
                            className="btn btn-primary"
                            onClick={handleInjectToProvider}
                            disabled={!bridgeTargetProvider || injecting || !handoverBriefing}
                            style={{
                              padding: '8px 16px',
                              fontSize: '0.85rem',
                              background: 'linear-gradient(to right, #8b5cf6, #06b6d4)',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              opacity: !bridgeTargetProvider ? 0.5 : 1
                            }}
                          >
                            {injected ? '✅ Injected!' : injecting ? 'Injecting...' : '⚡ Inject Context'}
                          </button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                          Saves this handover briefing as an active context record in the target provider's session database. The next time that provider calls <code>get_shared_context</code> via MCP, it will receive this handover.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(0, 0, 0, 0.1)'
            }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedSession(null)}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Close View
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}

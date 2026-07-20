'use client';

import React, { useEffect, useState } from 'react';
import { getProviderMeta } from '@/config/providers';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

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
    contextWindowLimit?: number;
    hourlyMessagesLimit?: number;
    hourlyMessagesUsed?: number;
    hourlyResetMinutes?: number;
    weeklyMessagesLimit?: number;
    weeklyMessagesUsed?: number;
    weeklyResetDays?: number;
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
    sender?: string;
  }>;
  workspace_path?: string;
  savings?: {
    costSaved: number;
    tokensSaved: number;
    percentSaved: number;
  };
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
  timeline?: Array<{
    date: string;
    label: string;
    tokens: number;
    cost: number;
  }>;
}

interface SystemStatus {
  workspacePath: string;
  watcher: { running: boolean };
  daemon: { 
    running: boolean; 
    pid: number | null; 
    activeAIProcesses: string[];
    health?: {
      pid: number;
      cpuUsage: number;
      memoryUsage: {
        rss: number;
        heapUsed: number;
      };
      uptime: number;
      syncCount: number;
      lastSyncAt: string | null;
      watcherActive: boolean;
      monitoredFilesCount: number;
      activeAIProcesses: string[];
      timestamp: string;
    } | null;
  };
  mcp: { 
    configuredInClaude: boolean; 
    configuredInCursor: boolean;
    server?: {
      running: boolean;
      pid: number | null;
      port: number;
    };
  };
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [metrics, setMetrics] = useState<ContextMetrics | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics>({ totalTokens: 0, totalCost: 0, breakdown: [], timeline: [] });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [workspacePath, setWorkspacePath] = useState('');
  const [gitBranch, setGitBranch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [togglingDaemon, setTogglingDaemon] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; logs?: string[] } | null>(null);

  // Session details & handover states
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [modalTab, setModalTab] = useState<'conversation' | 'handover' | 'plans'>('conversation');
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [pluginStatuses, setPluginStatuses] = useState<Array<{
    providerId: string;
    installed: boolean;
  }>>([]);

  // New states from step 4939 & 5063 & 6032
  const [launching, setLaunching] = useState<string>('');
  const [apiLatency, setApiLatency] = useState<number>(0);
  const [togglingMcpServer, setTogglingMcpServer] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatRelativeTime = (
    dateInput: string | Date | number,
    fallbackFormat: 'date' | 'datetime' = 'date'
  ): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (!mounted) {
      return fallbackFormat === 'datetime' ? date.toLocaleString() : date.toLocaleDateString();
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffSecs < 60) {
      return 'a moment ago';
    }
    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    }
    if (diffHrs < 24) {
      return `${diffHrs} ${diffHrs === 1 ? 'hour' : 'hours'} ago`;
    }

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `yesterday at ${timeStr}`;
    }

    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }

    return fallbackFormat === 'datetime' ? date.toLocaleString() : date.toLocaleDateString();
  };


  // Context Bridge states (used inside Session Details modal)
  const [bridgeTarget, setBridgeTarget] = useState('cursor');
  const [bridgeHandoverMarkdown, setBridgeHandoverMarkdown] = useState('');
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [bridgeCopied, setBridgeCopied] = useState(false);
  const [bridgeInjecting, setBridgeInjecting] = useState(false);
  const [bridgeInjected, setBridgeInjected] = useState(false);
  const [bridgeBriefingTab, setBridgeBriefingTab] = useState<'briefing' | 'compare'>('briefing');
  const [bridgeHandoverType, setBridgeHandoverType] = useState<'briefing' | 'original'>('briefing');
  


  // Reset bridge state and load details when selected session changes
  useEffect(() => {
    setBridgeHandoverMarkdown('');
    setBridgeBriefingTab('briefing');
    setBridgeHandoverType('briefing');
    setBridgeInjected(false);
    setSelectedPlanIdx(0);
    setSessionDetails(null);

    if (!selectedSession) return;

    const { id, provider_id, workspace_path } = selectedSession;

    async function fetchDetails() {
      setDetailsLoading(true);
      try {
        const res = await fetch(`/api/sessions/details?sessionId=${id}&providerId=${provider_id}&workspacePath=${encodeURIComponent(workspace_path || '')}`);
        if (res.ok) {
          const data = await res.json();
          setSessionDetails(data);
        }
      } catch (e) {
        console.error('Error fetching details:', e);
      } finally {
        setDetailsLoading(false);
      }
    }

    fetchDetails();
  }, [selectedSession?.id]);

  // Auto-update bridge handover when type changes (only if markdown already generated)
  useEffect(() => {
    if (selectedSession && bridgeHandoverMarkdown) {
      handleGenerateBridgeHandover();
    }
  }, [bridgeHandoverType]);

  async function handleGenerateBridgeHandover() {
    if (!selectedSession) return;
    setBridgeLoading(true);
    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'handover',
          sourceProviderId: selectedSession.provider_id,
          targetProviderId: bridgeTarget,
          sessionId: selectedSession.id,
          handoverType: bridgeHandoverType
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBridgeHandoverMarkdown(data.rawMarkdown);
        await loadData();
      }
    } catch (e) {
      console.error('Failed to generate handover:', e);
    } finally {
      setBridgeLoading(false);
    }
  }

  async function handleInjectBridgeToProvider() {
    if (!bridgeTarget || !bridgeHandoverMarkdown || !selectedSession) return;
    setBridgeInjecting(true);
    setBridgeInjected(false);

    const PROVIDER_NAMES: Record<string, string> = {
      'cursor': 'Cursor',
      'claude-code': 'Claude Code',
      'antigravity': 'Antigravity',
      'copilot': 'GitHub Copilot'
    };

    const sourceTitle = selectedSession.title || 'Session';

    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          providerId: bridgeTarget,
          title: "[Bridged from " + (PROVIDER_NAMES[selectedSession.provider_id] || selectedSession.provider_id) + "] " + sourceTitle,
          messages: bridgeHandoverType === 'original' && selectedSession?.messages
            ? selectedSession.messages.map(m => ({ role: m.role, content: m.content }))
            : [
                { role: 'system', content: bridgeHandoverMarkdown }
              ]
        })
      });
      if (res.ok) {
        setBridgeInjected(true);
        setTimeout(() => setBridgeInjected(false), 3000);
      } else {
        alert('Failed to inject context.');
      }
    } catch (e) {
      console.error('Inject failed:', e);
      alert('Error injecting context.');
    } finally {
      setBridgeInjecting(false);
    }
  }

  function handleCopyBridgeMarkdown() {
    navigator.clipboard.writeText(bridgeHandoverMarkdown);
    setBridgeCopied(true);
    setTimeout(() => setBridgeCopied(false), 2000);
  }

  async function handleToggleMcpServer() {
    if (!systemStatus) return;
    setTogglingMcpServer(true);
    const action = systemStatus.mcp.server?.running ? 'stop' : 'start';
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'mcp-server', action })
      });
      if (res.ok) {
        setTimeout(async () => {
          const sysRes = await fetch('/api/system');
          if (sysRes.ok) setSystemStatus(await sysRes.json());
          setTogglingMcpServer(false);
        }, 1500);
      } else {
        setTogglingMcpServer(false);
      }
    } catch (e) {
      console.error('Failed to toggle MCP server:', e);
      setTogglingMcpServer(false);
    }
  }


  async function loadData() {
    const start = performance.now();
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

      try {
        const plRes = await fetch(`/api/plugins?workspacePath=${encodeURIComponent(workspacePath || '')}`);
        if (plRes.ok) {
          const plData = await plRes.json();
          setPluginStatuses(plData.map((p: any) => ({ providerId: p.providerId, installed: p.installed })));
        }
      } catch {}
      setApiLatency(Math.round(performance.now() - start));
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
  }

  function showNotification(message: string, type: 'success' | 'error', logs?: string[]) {
    setNotification({ message, type, logs });
    setTimeout(() => setNotification(null), 8000);
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
        showNotification('Rules synced successfully across all providers!', 'success');
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
        showNotification('Setup completed successfully!', 'success', data.logs);
        await loadData();
      } else {
        showNotification(`Setup failed: ${data.error || 'Unknown error'}`, 'error', data.logs || []);
      }
    } catch (e: any) {
      showNotification(`Setup error: ${e.message || e}`, 'error');
    } finally {
      setSettingUp(false);
    }
  }

  function handleOpenSessionDetails(session: Session) {
    setSelectedSession(session);
    setModalTab('conversation');
  }

  const activeProviderCount = providers.filter(p => p.status === 'active').length;
  const totalTokensUsed = metrics?.totalWorkspaceTokens || 0;

  // Budget progress calculations for combined active provider limit
  const activeLimit = metrics ? Object.values(metrics.providers).reduce((sum: number, p: any) => sum + (p.contextWindowLimit || 0), 0) : 200000;
  const totalBudgetPercent = activeLimit > 0 ? Math.min(100, Math.round((totalTokensUsed / activeLimit) * 100)) : 0;

  return (
    <>
      {/* Revamped Dashboard Layout */}
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Inline notification banner */}
      {notification && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${notification.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: notification.type === 'success' ? '#34d399' : '#f87171', fontWeight: 600, fontSize: '0.9rem' }}>
              {notification.type === 'success' ? '✓' : '✗'} {notification.message}
            </span>
            <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>×</button>
          </div>
          {notification.logs && notification.logs.length > 0 && (
            <div style={{
              padding: '8px 10px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              maxHeight: '120px',
              overflowY: 'auto'
            }}>
              {notification.logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
          )}
        </div>
      )}

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
      </div>


      {/* Unified Timeline & Analytics Content */}
      <>
          {/* Setup status banner */}
          {pluginStatuses.some(p => !p.installed) && (
            <div style={{
              padding: '12px 20px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#fbbf24', fontSize: '0.9rem', fontWeight: 600 }}>
                  ⚠️ {pluginStatuses.filter(p => !p.installed).length} provider{pluginStatuses.filter(p => !p.installed).length > 1 ? 's' : ''} not fully configured
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {pluginStatuses.filter(p => !p.installed).map(p => getProviderMeta(p.providerId).name).join(', ')} — MCP server not registered
                </span>
              </div>
              <a href="/walkthrough#integrations" style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap'
              }}>
                Complete Setup →
              </a>
            </div>
          )}

          {/* Top Summary Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
            marginBottom: '0px'
          }}>
            {/* Card 1: Active Providers */}
            <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'var(--color-primary-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                color: 'var(--color-primary)'
              }}>
                🔌
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Active Providers</p>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '2px 0 0 0' }}>
                  {activeProviderCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {providers.length}</span>
                </h3>
              </div>
            </div>

            {/* Card 2: Shared Context Pool */}
            <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                color: 'var(--color-success)'
              }}>
                🪙
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Shared Context Pool</p>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '2px 0 0 0' }}>
                  {totalTokensUsed.toLocaleString()} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>tokens</span>
                </h3>
              </div>
            </div>

            {/* Card 3: Accrued Cost */}
            <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(6, 182, 212, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                color: 'var(--color-secondary)'
              }}>
                💲
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Accrued Session Cost</p>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '2px 0 0 0' }}>
                  ${costAnalytics.totalCost.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>USD</span>
                </h3>
              </div>
            </div>
          </div>
          {/* Main Grid: 2 columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: '16px',
            alignItems: 'start'
          }}>
            {/* Column 1: Timeline (Recent Handovers & Conversations) */}
            <div className="glass-panel" style={{ padding: '16px', minHeight: '480px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sessions.length === 0 ? (
                <>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Recent Handovers & Conversations</h3>
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
                    <p style={{ textAlign: 'center', maxWidth: '300px' }}>
                      No sessions found yet. NextRouter scans AI provider logs to build your session timeline.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" onClick={handleScan} style={{ fontSize: '0.85rem' }}>
                        🔄 Scan Workspace
                      </button>
                      <a href="/walkthrough" style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: 'var(--color-primary-glow)',
                        color: 'var(--color-primary)',
                        border: '1px solid var(--color-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}>
                        📖 View Setup Guide
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Recent Handovers & Conversations</h3>
                    <input
                      type="text"
                      placeholder="🔍 Search sessions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        fontSize: '0.8rem',
                        width: '180px',
                        outline: 'none',
                        transition: 'var(--transition-smooth)'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    />
                  </div>

                  {/* Provider Filter Tabs */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    gap: '6px', 
                    borderBottom: '1px solid var(--border-color)', 
                    paddingBottom: '10px'
                  }}>
                    {[
                      { id: 'all', name: 'All Providers', color: 'var(--color-primary)', bg: 'var(--color-primary-glow)' },
                      ...(['cursor', 'claude-code', 'antigravity', 'copilot'] as const).map(id => {
                        const m = getProviderMeta(id);
                        return { id, name: m.name, color: m.color, bg: m.colorBg };
                      })
                    ].map(tab => {
                      const isActive = filterProvider === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setFilterProvider(tab.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid',
                            background: isActive ? tab.bg : 'transparent',
                            color: isActive ? tab.color : 'var(--text-muted)',
                            borderColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                            fontWeight: 600,
                            fontSize: '0.78rem',
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

                  {/* Grouped Timeline sessions */}
                  {(() => {
                    const query = searchQuery.toLowerCase().trim();
                    const filtered = sessions.filter(s => {
                      const matchesProvider = filterProvider === 'all' || s.provider_id === filterProvider;
                      if (!matchesProvider) return false;
                      
                      if (!query) return true;
                      
                      const matchesTitle = s.title?.toLowerCase().includes(query);
                      const matchesPath = s.workspace_path?.toLowerCase().includes(query);
                      const matchesMessages = s.messages?.some(m => m.content?.toLowerCase().includes(query));
                      
                      return matchesTitle || matchesPath || matchesMessages;
                    });

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
                          <p>
                            {searchQuery 
                              ? `No sessions matching "${searchQuery}"` 
                              : `No sessions found for ${activeTabName}.`}
                          </p>
                        </div>
                      );
                    }

                    // Group sessions by workspace path
                    interface WorkspaceGroup {
                      workspacePath: string;
                      lastActiveAt: string;
                      sessions: Session[];
                    }

                    const groupsMap: Record<string, Session[]> = {};
                    for (const s of filtered) {
                      const ws = s.workspace_path || 'Global / No Workspace';
                      if (!groupsMap[ws]) {
                        groupsMap[ws] = [];
                      }
                      groupsMap[ws].push(s);
                    }

                    const grouped = Object.entries(groupsMap).map(([wsPath, sList]) => {
                      const sorted = sList.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
                      return {
                        workspacePath: wsPath,
                        lastActiveAt: sorted[0].last_active_at,
                        sessions: sorted
                      };
                    }).sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {grouped.map((group) => {
                          const wsDisplay = group.workspacePath === 'Global / No Workspace' 
                            ? '🌍 Global / No Workspace' 
                            : `📁 ${group.workspacePath.replace(/^\/Users\/[^\/]+/, '~')}`;
                          
                          return (
                            <div key={group.workspacePath} style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              padding: '10px 12px',
                              background: 'rgba(255, 255, 255, 0.015)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '10px',
                            }}>
                              {/* Workspace Header */}
                              <div 
                                onClick={() => {
                                  if (group.workspacePath !== 'Global / No Workspace') {
                                    setWorkspacePath(group.workspacePath);
                                  }
                                }}
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  borderBottom: `1px solid ${group.workspacePath === workspacePath ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.04)'}`,
                                  paddingBottom: '8px',
                                  marginBottom: '2px',
                                  cursor: group.workspacePath !== 'Global / No Workspace' ? 'pointer' : 'default',
                                  transition: 'var(--transition-smooth)'
                                }}
                                title={group.workspacePath !== 'Global / No Workspace' ? "Click to set as active workspace" : undefined}
                              >
                                <span style={{ 
                                  fontSize: '0.8rem', 
                                  fontWeight: 600, 
                                  color: group.workspacePath === workspacePath ? 'var(--color-primary)' : 'var(--text-main)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '6px' 
                                }}>
                                  {wsDisplay}
                                  {group.workspacePath === workspacePath && (
                                    <span style={{ 
                                      fontSize: '0.6rem', 
                                      background: 'var(--color-primary-glow)', 
                                      color: 'var(--color-primary)', 
                                      padding: '1px 6px', 
                                      borderRadius: '4px', 
                                      fontWeight: 700 
                                    }}>
                                      ACTIVE
                                    </span>
                                  )}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Active: {formatRelativeTime(group.lastActiveAt)}
                                </span>
                              </div>

                              {/* Sessions in this workspace */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {group.sessions.map((session) => {
                                  const sessionMeta = getProviderMeta(session.provider_id);
                                  const providerBg = sessionMeta.colorBg;
                                  const providerColor = sessionMeta.color;

                                  return (
                                    <div key={session.id} style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '8px 10px',
                                      borderRadius: '5px',
                                      background: 'rgba(255, 255, 255, 0.01)',
                                      border: '1px solid rgba(255, 255, 255, 0.02)',
                                      transition: 'var(--transition-smooth)',
                                      cursor: 'pointer'
                                    }} className="session-item-hover" onClick={() => handleOpenSessionDetails(session)}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{
                                            padding: '1px 5px',
                                            borderRadius: '3px',
                                            fontSize: '0.6rem',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            background: providerBg,
                                            color: providerColor
                                          }}>
                                            {sessionMeta.name}
                                          </span>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            {formatRelativeTime(session.last_active_at)}
                                          </span>
                                          {session.savings && session.savings.costSaved > 0 && (
                                            <span 
                                              style={{
                                                fontSize: '0.62rem',
                                                fontWeight: 600,
                                                color: '#10b981',
                                                background: 'rgba(16, 185, 129, 0.1)',
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px'
                                              }}
                                              title={`Saved ${session.savings.tokensSaved.toLocaleString()} tokens (${session.savings.percentSaved}% budget reduction) by context sharing`}
                                            >
                                              ⚡ Saved ${session.savings.costSaved.toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                        <h4 
                                          title={session.title}
                                          style={{ 
                                            fontSize: '0.9rem', 
                                            fontWeight: 600, 
                                            margin: 0, 
                                            color: 'var(--text-main)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            width: '100%'
                                          }}
                                        >
                                          {session.title}
                                        </h4>
                                      </div>
                                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{session.token_count.toLocaleString()}</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>tokens</span>
                                      </div>
                                    </div>
                                  );
                                })}
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

            {/* Column 2: Sidebar (Services + Usage Analytics Stacked) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Services Control Center */}
              <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
                  <span>⚙️ Services Control</span>
                  <span style={{ fontSize: '0.68rem', color: apiLatency < 50 ? 'var(--color-success)' : 'var(--color-primary)', fontWeight: 600 }}>
                    {apiLatency}ms {apiLatency < 50 ? '(cached)' : ''}
                  </span>
                </h3>
                
                {systemStatus ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                    
                    {/* 1. Daemon & Watcher Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: systemStatus.daemon.running ? 'var(--color-success)' : 'var(--text-dark)',
                            boxShadow: systemStatus.daemon.running ? '0 0 6px var(--color-success)' : 'none'
                          }} />
                          <span style={{ fontWeight: 600 }}>Sync Daemon</span>
                        </div>
                        <button 
                          className="btn" 
                          onClick={handleToggleDaemon}
                          disabled={togglingDaemon}
                          style={{ 
                            padding: '3px 6px', 
                            fontSize: '0.7rem',
                            background: systemStatus.daemon.running ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-primary-glow)',
                            color: systemStatus.daemon.running ? 'var(--color-danger)' : 'var(--color-primary)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {togglingDaemon ? '...' : systemStatus.daemon.running ? 'Stop' : 'Start'}
                        </button>
                      </div>
                      
                      {systemStatus.daemon.running && systemStatus.daemon.pid && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>PID: <code>{systemStatus.daemon.pid}</code> | Watcher: <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Active</span></span>
                            {systemStatus.daemon.health && (
                              <span>{systemStatus.daemon.health.cpuUsage}% CPU / {systemStatus.daemon.health.memoryUsage.rss}MB</span>
                            )}
                          </div>
                          {systemStatus.daemon.health && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px' }}>
                              <span>Files: <strong>{systemStatus.daemon.health.monitoredFilesCount}</strong></span>
                              <span>Syncs: <strong>{systemStatus.daemon.health.syncCount}</strong></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. MCP Server Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: systemStatus.mcp.server?.running ? 'var(--color-success)' : 'var(--text-dark)',
                            boxShadow: systemStatus.mcp.server?.running ? '0 0 6px var(--color-success)' : 'none'
                          }} />
                          <span style={{ fontWeight: 600 }}>MCP Server (SSE)</span>
                        </div>
                        <button 
                          className="btn" 
                          onClick={handleToggleMcpServer}
                          disabled={togglingMcpServer}
                          style={{ 
                            padding: '3px 6px', 
                            fontSize: '0.7rem',
                            background: systemStatus.mcp.server?.running ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-primary-glow)',
                            color: systemStatus.mcp.server?.running ? 'var(--color-danger)' : 'var(--color-primary)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {togglingMcpServer ? '...' : systemStatus.mcp.server?.running ? 'Stop' : 'Start'}
                        </button>
                      </div>

                      {systemStatus.mcp.server?.running && systemStatus.mcp.server?.pid && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between', paddingLeft: '13px' }}>
                          <span>PID: <code>{systemStatus.mcp.server.pid}</code></span>
                          <span 
                            style={{ cursor: 'help', textDecoration: 'underline dotted' }}
                            title={`SSE Endpoint:\nhttp://localhost:${systemStatus.mcp.server.port}/sse`}
                          >
                            Port: <code>{systemStatus.mcp.server.port}</code>
                          </span>
                        </div>
                      )}

                      {/* Integrations Pill Badges */}
                      <div style={{ display: 'flex', gap: '6px', paddingLeft: '13px', marginTop: '2px' }}>
                        <span 
                          title={systemStatus.mcp.configuredInClaude ? 'NextRouter MCP registered in Claude Code config' : 'NextRouter MCP not registered in Claude Code'}
                          style={{
                            padding: '2px 5px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            background: systemStatus.mcp.configuredInClaude ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                            color: systemStatus.mcp.configuredInClaude ? 'var(--color-success)' : 'var(--text-dark)',
                            border: `1px solid ${systemStatus.mcp.configuredInClaude ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`
                          }}
                        >
                          Claude {systemStatus.mcp.configuredInClaude ? '✓' : '✗'}
                        </span>
                        <span 
                          title={systemStatus.mcp.configuredInCursor ? 'NextRouter MCP registered in Cursor config' : 'NextRouter MCP not registered in Cursor'}
                          style={{
                            padding: '2px 5px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            background: systemStatus.mcp.configuredInCursor ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                            color: systemStatus.mcp.configuredInCursor ? 'var(--color-success)' : 'var(--text-dark)',
                            border: `1px solid ${systemStatus.mcp.configuredInCursor ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`
                          }}
                        >
                          Cursor {systemStatus.mcp.configuredInCursor ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={handleSyncRules}
                        disabled={syncing}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {syncing ? 'Syncing...' : '🔄 Sync Rules'}
                      </button>
                      
                      <button
                        className="btn btn-primary"
                        onClick={handleOneClickSetup}
                        disabled={settingUp}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: '0.72rem',
                          background: 'linear-gradient(to right, #8b5cf6, #06b6d4)',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 3px 8px rgba(139, 92, 246, 0.15)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {settingUp ? '⚡ Setup...' : '⚡ Local Setup'}
                      </button>
                    </div>

                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', height: '6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Loading system services status...
                  </div>
                )}
              </div>

              {/* Budget Gauge */}
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-start', width: '100%' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Overall Context Budget</h3>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    color: 'var(--color-primary)', 
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block'
                  }} title={workspacePath}>
                    📁 {workspacePath ? workspacePath.replace(/^\/Users\/[^\/]+/, '~') : 'No workspace selected'}
                  </span>
                </div>
                
                <div className="gauge-container" style={{ margin: '8px 0' }}>
                  <svg width="140" height="140" className="gauge-svg">
                    <circle cx="70" cy="70" r="60" className="gauge-bg" />
                    <circle cx="70" cy="70" r="60" className="gauge-fill" style={{
                      strokeDashoffset: 377 - (377 * totalBudgetPercent) / 100
                    }} />
                  </svg>
                  <div className="gauge-text">
                    <span style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{totalBudgetPercent}%</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>Used</span>
                  </div>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
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

                {/* Provider Limits & Usage */}
                {metrics && metrics.providers && Object.keys(metrics.providers).length > 0 && (
                  <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 600 }}>
                      Provider Limits & Usage
                    </h4>
                    {Object.entries(metrics.providers).map(([providerId, data]) => {
                      const meta = getProviderMeta(providerId);
                      const name = meta.name;
                      const color = meta.color;
                      const limit = data.contextWindowLimit || 128000;

                      if (limit === 0) return null;

                      const percent = Math.min(100, Math.round((data.totalTokens / limit) * 100));
                      
                      // Hourly rate limits
                      const hourlyUsed = data.hourlyMessagesUsed || 0;
                      const hourlyLimitVal = data.hourlyMessagesLimit || 0;
                      const hourlyPercent = hourlyLimitVal > 0 ? Math.min(100, Math.round((hourlyUsed / hourlyLimitVal) * 100)) : 0;
                      const hourlyReset = data.hourlyResetMinutes || 0;

                      // Weekly rate limits
                      const weeklyUsed = data.weeklyMessagesUsed || 0;
                      const weeklyLimitVal = data.weeklyMessagesLimit || 0;
                      const weeklyPercent = weeklyLimitVal > 0 ? Math.min(100, Math.round((weeklyUsed / weeklyLimitVal) * 100)) : 0;
                      const weeklyReset = data.weeklyResetDays || 0;

                      return (
                        <div key={providerId} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                          {/* Context Token Budget Bar */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                              <span style={{ fontWeight: 700, color }}>{name}</span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                {data.totalTokens.toLocaleString()} / <strong style={{ color: 'var(--text-main)' }}>{limit.toLocaleString()}</strong>
                              </span>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '5px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${percent}%`,
                                height: '100%',
                                background: color,
                                boxShadow: `0 0 6px ${color}`,
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>

                          {/* Supplementary Rate Limit Bars */}
                          {hourlyLimitVal > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.03)', paddingTop: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                <span>Hourly requests:</span>
                                <span>
                                  {hourlyUsed} / {hourlyLimitVal} {hourlyReset > 0 && `(resets in ${hourlyReset}m)`}
                                </span>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '3px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '1.5px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${hourlyPercent}%`,
                                  height: '100%',
                                  background: hourlyPercent > 80 ? 'var(--color-danger)' : 'rgba(255, 255, 255, 0.3)',
                                  borderRadius: '1.5px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          )}

                          {weeklyLimitVal > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                <span>Weekly requests:</span>
                                <span>
                                  {weeklyUsed} / {weeklyLimitVal} {weeklyReset > 0 && `(resets in ${weeklyReset}d)`}
                                </span>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '3px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '1.5px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${weeklyPercent}%`,
                                  height: '100%',
                                  background: weeklyPercent > 80 ? 'var(--color-danger)' : 'rgba(255, 255, 255, 0.3)',
                                  borderRadius: '1.5px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Estimated Cost breakdown */}
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Estimated Cost & Usage</h3>
                
                {costAnalytics.timeline && costAnalytics.timeline.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>📈 7-Day Spending Trend</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', height: '80px', padding: '6px 0' }}>
                      {(() => {
                        const maxVal = Math.max(...costAnalytics.timeline.map(d => d.cost), 0.01);
                        return costAnalytics.timeline.map((day, idx) => {
                          const heightPercent = Math.min((day.cost / maxVal) * 100, 100);
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '4px' }}>
                              <div 
                                style={{ 
                                  position: 'relative', 
                                  width: '18px', 
                                  height: '56px', 
                                  display: 'flex', 
                                  alignItems: 'end', 
                                  justifyContent: 'center',
                                  background: 'rgba(255, 255, 255, 0.02)',
                                  borderRadius: '3px'
                                }}
                                title={`${day.date}: $${day.cost.toFixed(2)} (${day.tokens.toLocaleString()} tokens)`}
                              >
                                <div style={{
                                  width: '100%',
                                  height: `${Math.max(heightPercent, day.cost > 0 ? 8 : 0)}%`,
                                  background: 'linear-gradient(to top, var(--color-primary), var(--color-primary-glow))',
                                  borderRadius: '3px',
                                  transition: 'height 0.4s ease',
                                  boxShadow: day.cost > 0 ? '0 0 8px var(--color-primary-glow)' : 'none'
                                }} />
                              </div>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{day.label}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>💵 Cost Breakdown by Provider</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {costAnalytics.breakdown.map((b) => (
                      <div key={b.providerId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{b.providerName}</span>
                        <span style={{ fontWeight: 600 }}>${b.cost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

          </div>
      </>
    </div>

      {/* Session Details Modal */}
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
                    const selectedMeta = getProviderMeta(selectedSession.provider_id);
                    const providerColor = selectedMeta.color;
                    const providerBg = selectedMeta.colorBg;
                    const providerLabel = selectedMeta.name;

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
                <h2 
                  title={selectedSession.title}
                  style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}
                >
                  {selectedSession.title}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Session ID: <code style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)' }}>{selectedSession.id}</code> &bull; Started: {formatRelativeTime(selectedSession.started_at, 'datetime')}
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
              <button
                onClick={() => setModalTab('plans')}
                style={{
                  padding: '16px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: modalTab === 'plans' ? '3px solid var(--color-primary)' : '3px solid transparent',
                  color: modalTab === 'plans' ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                📋 Active Plans {sessionDetails?.plans ? `(${sessionDetails.plans.length})` : ''}
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
                      const isUser = msg.role === 'user' && !msg.sender;
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
                              : msg.sender 
                                ? 'rgba(139, 92, 246, 0.05)' 
                                : 'rgba(255, 255, 255, 0.03)',
                            border: isUser 
                              ? 'none' 
                              : msg.sender 
                                ? '1px solid rgba(167, 139, 250, 0.3)' 
                                : '1px solid var(--border-color)',
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
                              {msg.sender 
                                ? `🤖 ${msg.sender}`
                                : isUser 
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
              ) : modalTab === 'handover' ? (
                /* Tab 2: Context Bridge */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  {/* Controls Row — compact inline */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Target Provider */}
                    <select
                      value={bridgeTarget}
                      onChange={(e) => setBridgeTarget(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        flex: '1 1 140px'
                      }}
                    >
                      {(['cursor', 'claude-code', 'antigravity', 'copilot'] as const)
                        .filter(id => id !== selectedSession.provider_id)
                        .map(id => (
                          <option key={id} value={id}>{getProviderMeta(id).name}</option>
                        ))}
                    </select>

                    {/* Handover Mode toggle */}
                    <div style={{
                      display: 'flex', gap: '3px',
                      background: 'rgba(0,0,0,0.25)', padding: '2px',
                      borderRadius: '8px', border: '1px solid var(--border-color)',
                      height: '34px', alignItems: 'center', flexShrink: 0
                    }}>
                      <button onClick={() => setBridgeHandoverType('briefing')} style={{
                        height: '28px', padding: '0 10px',
                        background: bridgeHandoverType === 'briefing' ? 'var(--color-primary)' : 'transparent',
                        color: bridgeHandoverType === 'briefing' ? 'var(--text-main)' : 'var(--text-muted)',
                        border: 'none', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'var(--transition-smooth)', whiteSpace: 'nowrap'
                      }}>📄 Briefing</button>
                      <button onClick={() => setBridgeHandoverType('original')} style={{
                        height: '28px', padding: '0 10px',
                        background: bridgeHandoverType === 'original' ? 'var(--color-primary)' : 'transparent',
                        color: bridgeHandoverType === 'original' ? 'var(--text-main)' : 'var(--text-muted)',
                        border: 'none', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'var(--transition-smooth)', whiteSpace: 'nowrap'
                      }}>💬 Original</button>
                    </div>

                    {/* Generate */}
                    <button
                      className="btn btn-primary"
                      onClick={handleGenerateBridgeHandover}
                      disabled={bridgeLoading}
                      style={{ padding: '6px 16px', fontSize: '0.82rem', borderRadius: '8px', height: '34px', flexShrink: 0 }}
                    >
                      {bridgeLoading ? '⏳ Compiling…' : '🚀 Generate'}
                    </button>
                  </div>


                  {/* Output Area */}
                  {!bridgeHandoverMarkdown ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', gap: '10px', padding: '28px 16px',
                      background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)',
                      borderRadius: '10px', fontSize: '0.82rem'
                    }}>
                      <span>⚡</span>
                      <span>Select a target provider and click <strong>Generate</strong> to compile a handover briefing.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Output Toolbar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <button
                            onClick={() => setBridgeBriefingTab('briefing')}
                            style={{
                              padding: '5px 12px',
                              background: bridgeBriefingTab === 'briefing' ? 'var(--color-primary)' : 'transparent',
                              color: bridgeBriefingTab === 'briefing' ? 'var(--text-main)' : 'var(--text-muted)',
                              border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                              transition: 'var(--transition-smooth)'
                            }}
                          >
                            {bridgeHandoverType === 'original' ? '💬 Logs' : '📄 Briefing'}
                          </button>
                          <button
                            onClick={() => setBridgeBriefingTab('compare')}
                            style={{
                              padding: '5px 12px',
                              background: bridgeBriefingTab === 'compare' ? 'var(--color-primary)' : 'transparent',
                              color: bridgeBriefingTab === 'compare' ? 'var(--text-main)' : 'var(--text-muted)',
                              border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                              transition: 'var(--transition-smooth)'
                            }}
                          >
                            ⚖️ Compare
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-primary"
                            onClick={handleInjectBridgeToProvider}
                            disabled={bridgeInjecting}
                            style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '8px' }}
                          >
                            {bridgeInjecting ? '⏳ Injecting...' : bridgeInjected ? '✅ Injected!' : `⚡ Inject to ${getProviderMeta(bridgeTarget).name}`}
                          </button>
                          <button className="btn btn-secondary" onClick={handleCopyBridgeMarkdown} style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '8px' }}>
                            {bridgeCopied ? '✅ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>

                      {bridgeBriefingTab === 'briefing' ? (
                        <MarkdownRenderer
                          content={bridgeHandoverMarkdown}
                          height="320px"
                        />
                      ) : (() => {
                        const originalTokens = selectedSession.token_count || 0;
                        const briefingChars = bridgeHandoverMarkdown.length;
                        const hasSavings = !!(selectedSession.savings && selectedSession.savings.tokensSaved > 0);
                        const savedTokens = (hasSavings && selectedSession.savings) ? selectedSession.savings.tokensSaved : Math.max(0, originalTokens - Math.round(briefingChars / 4));
                        const briefingTokens = hasSavings ? (originalTokens - savedTokens) : Math.round(briefingChars / 4);
                        const percentSaved = originalTokens > 0 ? Math.round((savedTokens / originalTokens) * 100) : 0;
                        const costSaved = (hasSavings && selectedSession.savings) ? selectedSession.savings.costSaved : 0;

                        const originalText = selectedSession.messages && selectedSession.messages.length > 0
                          ? selectedSession.messages.map((m) => {
                              const roleLabel = m.role === 'user' ? '👤 User' : m.role === 'system' ? '⚙️ System' : '🤖 Assistant';
                              const time = m.timestamp ? ` [${new Date(m.timestamp).toLocaleTimeString()}]` : '';
                              const tokens = m.tokens ? ` (${m.tokens} tokens)` : '';
                              return `${roleLabel}${time}${tokens}:\n${m.content}`;
                            }).join('\n\n--------------------------------------------------\n\n')
                          : 'No conversation logs found.';

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Stats */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                              gap: '10px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '10px',
                              padding: '10px 14px'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700 }}>{originalTokens.toLocaleString()} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>tokens</span></span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Briefing</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#06b6d4' }}>{briefingTokens.toLocaleString()} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>tokens</span></span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>{percentSaved}% <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{savedTokens.toLocaleString()} tokens</span></span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Saved</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>${costSaved.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Side by side */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>💬 Original Messages</span>
                                <textarea
                                  readOnly
                                  value={originalText}
                                  style={{
                                    width: '100%', height: '240px', padding: '10px',
                                    background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-color)',
                                    borderRadius: '8px', color: '#e5e7eb', fontFamily: 'var(--font-mono)',
                                    fontSize: '0.72rem', lineHeight: '1.4', resize: 'none', outline: 'none', scrollbarWidth: 'thin'
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#06b6d4' }}>🔄 Handover Briefing</span>
                                <textarea
                                  readOnly
                                  value={bridgeHandoverMarkdown}
                                  style={{
                                    width: '100%', height: '240px', padding: '10px',
                                    background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-color)',
                                    borderRadius: '8px', color: '#e5e7eb', fontFamily: 'var(--font-mono)',
                                    fontSize: '0.72rem', lineHeight: '1.4', resize: 'none', outline: 'none', scrollbarWidth: 'thin'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                /* Tab 3: Active Plans */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '400px' }}>
                  {detailsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(255,255,255,0.1)',
                          borderTopColor: 'var(--color-primary)',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          display: 'inline-block'
                        }}></span>
                        Loading active plans...
                      </span>
                    </div>
                  ) : !sessionDetails?.plans || sessionDetails.plans.length === 0 ? (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      height: '300px', color: 'var(--text-muted)', gap: '12px'
                    }}>
                      <span style={{ fontSize: '2rem' }}>📋</span>
                      <p>No active plan files found in this workspace.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: '380px' }}>
                      {/* Left: Plan Files list */}
                      <div style={{ 
                        width: '240px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '6px', 
                        borderRight: '1px solid var(--border-color)', 
                        paddingRight: '12px', 
                        flexShrink: 0,
                        maxHeight: '420px',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin'
                      }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Plan Files</span>
                        {sessionDetails.plans.map((p: any, idx: number) => (
                          <button
                            key={p.name}
                            onClick={() => setSelectedPlanIdx(idx)}
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              background: selectedPlanIdx === idx ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                              border: selectedPlanIdx === idx ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                              borderRadius: '8px',
                              color: selectedPlanIdx === idx ? 'var(--text-main)' : 'var(--text-muted)',
                              fontSize: '0.82rem',
                              fontWeight: selectedPlanIdx === idx ? 600 : 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.2s ease',
                              width: '100%'
                            }}
                          >
                            <span style={{ fontSize: '1rem', flexShrink: 0 }}>📄</span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, overflow: 'hidden' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{p.name}</span>
                              {p.mtime && (
                                <span style={{ fontSize: '0.68rem', color: selectedPlanIdx === idx ? 'rgba(255, 255, 255, 0.5)' : 'var(--text-muted)', marginTop: '2px' }}>
                                  {formatRelativeTime(p.mtime)}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                      {/* Right: Selected Plan Content */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                              {sessionDetails.plans[selectedPlanIdx]?.name}
                            </span>
                            {sessionDetails.plans[selectedPlanIdx]?.mtime && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Updated {formatRelativeTime(sessionDetails.plans[selectedPlanIdx].mtime, 'datetime')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sessionDetails.plans[selectedPlanIdx]?.path}>
                            {sessionDetails.plans[selectedPlanIdx]?.path.replace(/^\/Users\/[^\/]+/, '~')}
                          </div>
                        </div>
                        <MarkdownRenderer
                          content={sessionDetails.plans[selectedPlanIdx]?.content || ''}
                          height="320px"
                        />
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
    </>
  );
}
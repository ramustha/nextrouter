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

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [metrics, setMetrics] = useState<ContextMetrics | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics>({ totalTokens: 0, totalCost: 0, breakdown: [] });
  const [workspacePath, setWorkspacePath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function loadData() {
    try {
      const pRes = await fetch('/api/providers');
      if (pRes.ok) setProviders(await pRes.json());

      const mRes = await fetch(`/api/context?workspacePath=${encodeURIComponent(workspacePath)}`);
      if (mRes.ok) setMetrics(await mRes.json());

      const sRes = await fetch(`/api/sessions?workspacePath=${encodeURIComponent(workspacePath)}`);
      if (sRes.ok) setSessions(await sRes.json());

      const cRes = await fetch('/api/tokens/usage');
      if (cRes.ok) setCostAnalytics(await cRes.json());
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
  }

  useEffect(() => {
    setWorkspacePath(window.location.pathname || '');
    loadData();
  }, []);

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

  const activeProviderCount = providers.filter(p => p.status === 'active').length;
  const totalTokensUsed = metrics?.totalWorkspaceTokens || 0;

  // Budget progress calculations for model limit (based on Sonnet 200k limit)
  const sonnetLimit = 200000;
  const totalBudgetPercent = Math.min(100, Math.round((totalTokensUsed / sonnetLimit) * 100));

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Workspace Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Monitor and coordinate context usage across your coding assistants
          </p>
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
            <h3 style={{ fontSize: '1.15rem', alignSelf: 'flex-start' }}>Claude 3.5 Sonnet Budget</h3>
            
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
                <span style={{ color: 'var(--text-muted)' }}>Token Limit:</span>
                <span style={{ fontWeight: 600 }}>{sonnetLimit.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Accumulated:</span>
                <span style={{ fontWeight: 600 }}>{totalTokensUsed.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remaining:</span>
                <span style={{ fontWeight: 600, color: totalBudgetPercent > 90 ? 'var(--color-danger)' : 'var(--text-main)' }}>
                  {Math.max(0, sonnetLimit - totalTokensUsed).toLocaleString()}
                </span>
              </div>
            </div>
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

        </div>

        {/* Right Side: Timeline Sessions */}
        <div className="glass-panel" style={{ padding: '24px', minHeight: '480px' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '20px' }}>Recent Handovers & Conversations</h3>
          
          {sessions.length === 0 ? (
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sessions.slice(0, 7).map((session) => (
                <div key={session.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  transition: 'var(--transition-smooth)',
                  cursor: 'pointer'
                }} className="session-item-hover">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background: session.provider_id === 'claude-code' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                        color: session.provider_id === 'claude-code' ? 'var(--color-primary)' : 'var(--color-secondary)'
                      }}>
                        {session.provider_id}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(session.last_active_at).toLocaleDateString()} at {new Date(session.last_active_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{session.title}</h4>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{session.token_count.toLocaleString()}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>tokens</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

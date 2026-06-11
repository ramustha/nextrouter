'use client';

import React, { useState, useEffect } from 'react';

interface Session {
  id: string;
  provider_id: string;
  title: string;
  token_count: number;
}

interface PrunerResult {
  prunedContent: string;
  originalTokens: number;
  prunedTokens: number;
  savedTokens: number;
  savedPercent: number;
}

export default function ContextBridgePage() {
  const [activeTab, setActiveTab] = useState('bridge');
  
  // Bridge State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sourceProvider, setSourceProvider] = useState('claude-code');
  const [targetProvider, setTargetProvider] = useState('cursor');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [handoverMarkdown, setHandoverMarkdown] = useState('');
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pruner State
  const [filename, setFilename] = useState('index.ts');
  const [codeContent, setCodeContent] = useState('');
  const [prunedResult, setPrunedResult] = useState<PrunerResult | null>(null);
  const [loadingPruner, setLoadingPruner] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions');
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
          const filtered = data.filter((s: Session) => s.provider_id === sourceProvider);
          if (filtered.length > 0) {
            setSelectedSessionId(filtered[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load sessions:', e);
      }
    }
    loadSessions();
  }, [sourceProvider]);

  async function handleGenerateHandover() {
    if (!selectedSessionId) {
      alert('Please select a session first.');
      return;
    }
    setLoadingBridge(true);
    try {
      const res = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'handover',
          sourceProviderId: sourceProvider,
          targetProviderId: targetProvider,
          sessionId: selectedSessionId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setHandoverMarkdown(data.rawMarkdown);
      }
    } catch (e) {
      console.error('Failed to generate handover:', e);
    } finally {
      setLoadingBridge(false);
    }
  }

  async function handlePrune() {
    if (!codeContent.trim()) {
      alert('Please paste some code first.');
      return;
    }
    setLoadingPruner(true);
    try {
      const res = await fetch('/api/context/prune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          content: codeContent
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPrunedResult(data);
      }
    } catch (e) {
      console.error('Pruning failed:', e);
    } finally {
      setLoadingPruner(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(handoverMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filteredSessions = sessions.filter(s => s.provider_id === sourceProvider);

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Context Workspace</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Coordinate, compress, and transition codebase context across your AI assistants
          </p>
        </div>
        
        {/* Tab Selector Buttons */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button 
            className="btn" 
            onClick={() => setActiveTab('bridge')}
            style={{ 
              background: activeTab === 'bridge' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'bridge' ? 'var(--text-main)' : 'var(--text-muted)',
              padding: '8px 16px',
              fontSize: '0.85rem'
            }}
          >
            ⚡ Context Bridge
          </button>
          <button 
            className="btn" 
            onClick={() => setActiveTab('pruner')}
            style={{ 
              background: activeTab === 'pruner' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'pruner' ? 'var(--text-main)' : 'var(--text-muted)',
              padding: '8px 16px',
              fontSize: '0.85rem'
            }}
          >
            ✂️ Code Pruner
          </button>
        </div>
      </div>

      {activeTab === 'bridge' ? (
        /* BRIDGE INTERFACE */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: '32px',
          alignItems: 'start'
        }}>
          {/* Configurator */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.15rem' }}>Configure Handover</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>1. Source Provider</label>
              <select 
                value={sourceProvider} 
                onChange={(e) => setSourceProvider(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              >
                <option value="claude-code">Claude Code</option>
                <option value="cursor">Cursor</option>
                <option value="antigravity">Antigravity</option>
                <option value="copilot">GitHub Copilot</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>2. Target Provider</label>
              <select 
                value={targetProvider} 
                onChange={(e) => setTargetProvider(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              >
                <option value="cursor">Cursor</option>
                <option value="claude-code">Claude Code</option>
                <option value="antigravity">Antigravity</option>
                <option value="copilot">GitHub Copilot</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>3. Source Conversation Session</label>
              {filteredSessions.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-warning)', padding: '10px' }}>
                  ⚠️ No sessions found for this provider on disk.
                </p>
              ) : (
                <select 
                  value={selectedSessionId} 
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                >
                  {filteredSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.token_count.toLocaleString()} tokens)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button 
              className="btn btn-primary" 
              onClick={handleGenerateHandover}
              disabled={loadingBridge || filteredSessions.length === 0}
              style={{ width: '100%', marginTop: '12px' }}
            >
              {loadingBridge ? 'Compiling Packet...' : '🚀 Generate Handover Packet'}
            </button>
          </div>

          {/* View Briefing */}
          <div className="glass-panel" style={{ padding: '24px', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem' }}>Handover Packet Briefing</h3>
              {handoverMarkdown && (
                <button className="btn btn-secondary" onClick={handleCopy} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  {copied ? '✅ Copied!' : '📋 Copy Briefing'}
                </button>
              )}
            </div>

            {!handoverMarkdown ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: 'var(--text-muted)',
                gap: '12px',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                padding: '40px'
              }}>
                <span style={{ fontSize: '2.5rem' }}>📄</span>
                <p style={{ textAlign: 'center' }}>Configure and click "Generate" to compile a portable markdown handover context.</p>
              </div>
            ) : (
              <textarea
                readOnly
                value={handoverMarkdown}
                style={{
                  flex: 1,
                  width: '100%',
                  minHeight: '320px',
                  padding: '16px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            )}
          </div>
        </div>
      ) : (
        /* PRUNER INTERFACE */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '32px',
          alignItems: 'start'
        }}>
          {/* Paste Original Code */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem' }}>Source Code Input</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filename:</span>
                <input 
                  type="text" 
                  value={filename} 
                  onChange={(e) => setFilename(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    width: '120px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <textarea
              placeholder="Paste raw JavaScript, TypeScript, or Python code here to compress..."
              value={codeContent}
              onChange={(e) => setCodeContent(e.target.value)}
              style={{
                flex: 1,
                width: '100%',
                minHeight: '300px',
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                resize: 'none',
                outline: 'none'
              }}
            />

            <button 
              className="btn btn-primary" 
              onClick={handlePrune}
              disabled={loadingPruner || !codeContent.trim()}
              style={{ width: '100%' }}
            >
              {loadingPruner ? 'Analyzing Outline...' : '✂️ Prune Implementation Dials'}
            </button>
          </div>

          {/* Compressed Outputs */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '480px' }}>
            <h3 style={{ fontSize: '1.15rem' }}>Pruned Context Output</h3>

            {!prunedResult ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: 'var(--text-muted)',
                gap: '12px',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                padding: '40px'
              }}>
                <span style={{ fontSize: '2.5rem' }}>✂️</span>
                <p style={{ textAlign: 'center' }}>Paste source code and run Prune to strip implementation bodies and see token reductions.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                
                {/* Savings Metrics Row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  fontSize: '0.9rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Tokens: </span>
                    <span style={{ fontWeight: 600 }}>{prunedResult.originalTokens}</span>
                    <span style={{ color: 'var(--text-dark)' }}> → </span>
                    <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{prunedResult.prunedTokens}</span>
                  </div>
                  <div style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                    Saved {prunedResult.savedPercent}% Tokens!
                  </div>
                </div>

                <textarea
                  readOnly
                  value={prunedResult.prunedContent}
                  style={{
                    flex: 1,
                    width: '100%',
                    minHeight: '260px',
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    resize: 'none',
                    outline: 'none'
                  }}
                />

                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    navigator.clipboard.writeText(prunedResult.prunedContent);
                    alert('Pruned content copied!');
                  }}
                  style={{ width: '100%' }}
                >
                  📋 Copy Pruned Outline
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

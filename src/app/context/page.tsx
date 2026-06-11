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

interface GitFileStatus {
  filepath: string;
  status: string;
  code: string;
}

interface GitStatusResult {
  isRepository: boolean;
  branch: string;
  files: GitFileStatus[];
}

function DiffViewer({ diff }: { diff: string }) {
  if (!diff) {
    return (
      <div style={{ padding: '20px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
        No changes or empty diff.
      </div>
    );
  }

  const lines = diff.split('\n');
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.85rem',
      lineHeight: '1.5',
      overflowX: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      background: 'rgba(0, 0, 0, 0.25)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      padding: '16px',
      maxHeight: '450px',
      overflowY: 'auto'
    }}>
      {lines.map((line, idx) => {
        let color = 'inherit';
        let bg = 'transparent';
        if (line.startsWith('+') && !line.startsWith('+++')) {
          color = 'rgba(16, 185, 129, 0.95)'; // emerald-500
          bg = 'rgba(16, 185, 129, 0.05)';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          color = 'rgba(239, 68, 68, 0.95)'; // red-500
          bg = 'rgba(239, 68, 68, 0.05)';
        } else if (line.startsWith('@@')) {
          color = 'var(--color-primary)';
          bg = 'var(--color-primary-glow)';
        }
        return (
          <div key={idx} style={{ color, backgroundColor: bg, padding: '2px 4px', borderRadius: '2px' }}>
            {line}
          </div>
        );
      })}
    </div>
  );
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

  // Git State
  const [gitStatus, setGitStatus] = useState<GitStatusResult>({
    isRepository: false,
    branch: '',
    files: []
  });
  const [selectedGitFile, setSelectedGitFile] = useState<string>('');
  const [gitDiff, setGitDiff] = useState<string>('');
  const [loadingGit, setLoadingGit] = useState(false);
  const [loadingGitDiff, setLoadingGitDiff] = useState(false);
  const [copiedGit, setCopiedGit] = useState(false);

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

  // Fetch Git Status
  async function loadGitStatus() {
    setLoadingGit(true);
    try {
      const res = await fetch('/api/git');
      if (res.ok) {
        const data = await res.json();
        setGitStatus(data);
        if (data.files.length > 0 && !selectedGitFile) {
          // don't auto-load diff unless requested
        }
      }
    } catch (e) {
      console.error('Failed to load git status:', e);
    } finally {
      setLoadingGit(false);
    }
  }

  useEffect(() => {
    loadGitStatus();
  }, []);

  async function handleFetchDiff(filepath: string) {
    setSelectedGitFile(filepath);
    setLoadingGitDiff(true);
    setGitDiff('');
    try {
      const res = await fetch(`/api/git?action=diff&file=${encodeURIComponent(filepath)}`);
      if (res.ok) {
        const data = await res.json();
        setGitDiff(data.diff);
      }
    } catch (e) {
      console.error('Failed to load file diff:', e);
    } finally {
      setLoadingGitDiff(false);
    }
  }

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

  function handleCopyDiff() {
    if (!gitDiff) return;
    navigator.clipboard.writeText(gitDiff);
    setCopiedGit(true);
    setTimeout(() => setCopiedGit(false), 2000);
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
          <button 
            className="btn" 
            onClick={() => setActiveTab('git')}
            style={{ 
              background: activeTab === 'git' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'git' ? 'var(--text-main)' : 'var(--text-muted)',
              padding: '8px 16px',
              fontSize: '0.85rem'
            }}
          >
            📁 Git Changes
          </button>
        </div>
      </div>

      {activeTab === 'bridge' && (
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
      )}

      {activeTab === 'pruner' && (
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

      {activeTab === 'git' && (
        /* GIT INTERFACE */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.5fr',
          gap: '32px',
          alignItems: 'start'
        }}>
          {/* Git Files List */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📁 Workspace Changes
                {gitStatus.isRepository && (
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'var(--color-primary-glow)',
                    color: 'var(--color-primary)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 500
                  }}>
                    branch: {gitStatus.branch}
                  </span>
                )}
              </h3>
              <button 
                className="btn btn-secondary" 
                onClick={loadGitStatus} 
                disabled={loadingGit}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                {loadingGit ? 'Scanning...' : '🔄 Refresh'}
              </button>
            </div>

            {!gitStatus.isRepository ? (
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
                <span style={{ fontSize: '2.5rem' }}>⚠️</span>
                <p style={{ textAlign: 'center' }}>Git is not initialized in this workspace or path is not a repository.</p>
              </div>
            ) : gitStatus.files.length === 0 ? (
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
                <span style={{ fontSize: '2.5rem' }}>✨</span>
                <p style={{ textAlign: 'center', color: 'var(--color-success)', fontWeight: 500 }}>Workspace is clean!</p>
                <p style={{ fontSize: '0.8rem', textAlign: 'center', color: 'var(--text-muted)' }}>No modified or untracked files detected.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '380px' }}>
                {gitStatus.files.map((file) => {
                  let badgeBg = 'rgba(75, 85, 99, 0.1)';
                  let badgeColor = 'var(--text-muted)';
                  
                  if (file.status === 'modified') {
                    badgeBg = 'rgba(245, 158, 11, 0.15)';
                    badgeColor = 'var(--color-warning)';
                  } else if (file.status === 'untracked' || file.status === 'added') {
                    badgeBg = 'rgba(16, 185, 129, 0.15)';
                    badgeColor = 'var(--color-success)';
                  } else if (file.status === 'deleted') {
                    badgeBg = 'rgba(239, 68, 68, 0.15)';
                    badgeColor = 'var(--color-danger)';
                  }

                  const isSelected = selectedGitFile === file.filepath;

                  return (
                    <div 
                      key={file.filepath}
                      onClick={() => handleFetchDiff(file.filepath)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
                      }}
                      className="git-file-row"
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        <span style={{ 
                          fontSize: '0.9rem', 
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? 'var(--color-primary)' : 'var(--text-main)',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap'
                        }}>
                          {file.filepath.split('/').pop()}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {file.filepath}
                        </span>
                      </div>
                      
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: badgeBg,
                        color: badgeColor,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {file.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Git Diff Viewer */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem' }}>Git Line Diff</h3>
              {gitDiff && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCopyDiff} 
                  disabled={!gitDiff}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  {copiedGit ? '✅ Copied!' : '📋 Copy Diff'}
                </button>
              )}
            </div>

            {!selectedGitFile ? (
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
                <span style={{ fontSize: '2.5rem' }}>🔍</span>
                <p style={{ textAlign: 'center' }}>Select a file from the workspace changes list to view its code modifications.</p>
              </div>
            ) : loadingGitDiff ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: 'var(--text-muted)'
              }}>
                <p>Generating diff...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Showing diff for <strong style={{ color: 'var(--text-main)' }}>{selectedGitFile}</strong>
                </div>
                <DiffViewer diff={gitDiff} />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

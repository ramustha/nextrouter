'use client';

import React, { useState, useEffect } from 'react';

interface Rule {
  id: string;
  provider_id: string;
  filename: string;
  content: string;
  last_updated_at: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [mergedRules, setMergedRules] = useState('');
  const [drift, setDrift] = useState(false);
  const [driftDetails, setDriftDetails] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function loadRules() {
    try {
      const res = await fetch('/api/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
        setMergedRules(data.merged);
        setDrift(data.drift);
        setDriftDetails(data.driftDetails);
        
        if (data.rules.length > 0 && !activeTab) {
          setActiveTab(data.rules[0].id);
          setEditorContent(data.rules[0].content);
        }
      }
    } catch (e) {
      console.error('Error loading rules:', e);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    const activeRule = rules.find(r => r.id === activeTab);
    if (activeRule) {
      setEditorContent(activeRule.content);
    }
  }, [activeTab, rules]);

  async function handleSave() {
    const activeRule = rules.find(r => r.id === activeTab);
    if (!activeRule) return;

    setSaving(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          rules: [{ ...activeRule, content: editorContent }]
        })
      });
      if (res.ok) {
        alert('Rule saved and updated locally!');
        await loadRules();
      }
    } catch (e) {
      console.error('Failed to save rule:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' })
      });
      if (res.ok) {
        alert('Unified rule configuration synced successfully to all active providers!');
        await loadRules();
      }
    } catch (e) {
      console.error('Failed to sync rules:', e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Rules Manager</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Synchronize and edit project guidelines across all provider rule files
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing...' : '⚡ Push & Sync Rules'}
        </button>
      </div>

      {/* Rules Drift Alert Banner */}
      {drift && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: 'var(--color-danger)',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px'
        }}>
          <div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span> Configuration Drift Detected
            </div>
            <p style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px' }}>
              Rules are out of sync. Some files were modified independently in your IDE (e.g. {driftDetails.join(', ')}).
            </p>
          </div>
          <button className="btn" onClick={handleSync} disabled={syncing} style={{ 
            background: 'var(--color-danger)', 
            color: 'var(--text-main)',
            fontSize: '0.8rem',
            padding: '8px 16px',
            border: 'none',
            whiteSpace: 'nowrap'
          }}>
            Resolve Conflicts & Sync
          </button>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: '32px',
        alignItems: 'start'
      }}>
        
        {/* Left Side: Rule tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
            Rules Files
          </p>
          {rules.length === 0 ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No rule files found on disk.</span>
          ) : (
            rules.map((rule) => (
              <div 
                key={rule.id} 
                onClick={() => setActiveTab(rule.id)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: activeTab === rule.id ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                  border: `1px solid ${activeTab === rule.id ? 'var(--border-color-active)' : 'var(--border-color)'}`,
                  color: activeTab === rule.id ? 'var(--color-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: activeTab === rule.id ? 600 : 500,
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span>{rule.filename}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>{rule.provider_id}</span>
              </div>
            ))
          )}
        </div>

        {/* Right Side: Rule editor */}
        <div className="glass-panel" style={{ padding: '24px', minHeight: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem' }}>
              Edit {rules.find(r => r.id === activeTab)?.filename || 'Rule Config'}
            </h3>
            {rules.length > 0 && (
              <button className="btn btn-secondary" onClick={handleSave} disabled={saving} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            )}
          </div>

          {rules.length === 0 ? (
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
              <span style={{ fontSize: '2.5rem' }}>⚙️</span>
              <p>Configure rule files in workspace directory to load rules editor.</p>
            </div>
          ) : (
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              style={{
                flex: 1,
                width: '100%',
                minHeight: '360px',
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

    </div>
  );
}

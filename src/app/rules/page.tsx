'use client';

import React, { useState, useEffect } from 'react';

interface Rule {
  id: string;
  provider_id: string;
  filename: string;
  content: string;
  last_updated_at: string;
}

interface Skill {
  id: string;
  name: string;
  version: string;
  content: string;
  tags?: string;
  auto_inject: number;
}

export default function RulesPage() {
  // Tabs
  const [activePageTab, setActivePageTab] = useState<'rules' | 'skills'>('rules');

  // Rules states
  const [rules, setRules] = useState<Rule[]>([]);
  const [mergedRules, setMergedRules] = useState('');
  const [drift, setDrift] = useState(false);
  const [driftDetails, setDriftDetails] = useState<string[]>([]);
  const [activeRuleTab, setActiveRuleTab] = useState('');
  const [ruleEditorContent, setRuleEditorContent] = useState('');
  const [savingRule, setSavingRule] = useState(false);
  const [syncingRules, setSyncingRules] = useState(false);

  // Skills states
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [skillName, setSkillName] = useState('');
  const [skillVersion, setSkillVersion] = useState('1.0');
  const [skillContent, setSkillContent] = useState('');
  const [skillAutoInject, setSkillAutoInject] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);

  async function loadRules() {
    try {
      const res = await fetch('/api/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
        setMergedRules(data.merged);
        setDrift(data.drift);
        setDriftDetails(data.driftDetails);
        
        if (data.rules.length > 0 && !activeRuleTab) {
          setActiveRuleTab(data.rules[0].id);
          setRuleEditorContent(data.rules[0].content);
        }
      }
    } catch (e) {
      console.error('Error loading rules:', e);
    }
  }

  async function loadSkills() {
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        const data = await res.json();
        setSkills(data);
        if (data.length > 0 && !selectedSkillId) {
          selectSkill(data[0]);
        }
      }
    } catch (e) {
      console.error('Error loading skills:', e);
    }
  }

  useEffect(() => {
    loadRules();
    loadSkills();
  }, []);

  useEffect(() => {
    const activeRule = rules.find(r => r.id === activeRuleTab);
    if (activeRule) {
      setRuleEditorContent(activeRule.content);
    }
  }, [activeRuleTab, rules]);

  async function handleSaveRule() {
    const activeRule = rules.find(r => r.id === activeRuleTab);
    if (!activeRule) return;

    setSavingRule(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          rules: [{ ...activeRule, content: ruleEditorContent }]
        })
      });
      if (res.ok) {
        alert('Rule saved and updated locally!');
        await loadRules();
      }
    } catch (e) {
      console.error('Failed to save rule:', e);
    } finally {
      setSavingRule(false);
    }
  }

  async function handleSyncRules() {
    setSyncingRules(true);
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
      setSyncingRules(false);
    }
  }

  // Skill actions
  function selectSkill(skill: Skill) {
    setSelectedSkillId(skill.id);
    setSkillName(skill.name);
    setSkillVersion(skill.version);
    setSkillContent(skill.content);
    setSkillAutoInject(skill.auto_inject === 1);
  }

  function handleNewSkill() {
    setSelectedSkillId('');
    setSkillName('New Skill');
    setSkillVersion('1.0');
    setSkillContent('# New Universal Skill\n- Always follow naming conventions\n- ...');
    setSkillAutoInject(false);
  }

  async function handleSaveSkill() {
    setSavingSkill(true);
    try {
      const isEdit = !!selectedSkillId;
      const res = await fetch('/api/skills', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSkillId,
          name: skillName,
          version: skillVersion,
          content: skillContent,
          autoInject: skillAutoInject
        })
      });
      if (res.ok) {
        alert(isEdit ? 'Skill updated!' : 'New skill created!');
        await loadSkills();
      }
    } catch (e) {
      console.error('Failed to save skill:', e);
    } finally {
      setSavingSkill(false);
    }
  }

  async function handleDeleteSkill() {
    if (!selectedSkillId) return;
    if (!confirm('Are you sure you want to delete this skill?')) return;

    setSavingSkill(true);
    try {
      const res = await fetch(`/api/skills?id=${selectedSkillId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Skill deleted!');
        setSelectedSkillId('');
        setSkillName('');
        setSkillVersion('1.0');
        setSkillContent('');
        setSkillAutoInject(false);
        await loadSkills();
      }
    } catch (e) {
      console.error('Failed to delete skill:', e);
    } finally {
      setSavingSkill(false);
    }
  }

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Rules & Skills Manager</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            {activePageTab === 'rules' 
              ? 'Synchronize and edit project guidelines across all provider rule files' 
              : 'Author reusable prompts and rules that auto-propagate to all AI providers'}
          </p>
        </div>
        {activePageTab === 'rules' ? (
          <button className="btn btn-primary" onClick={handleSyncRules} disabled={syncingRules}>
            {syncingRules ? 'Syncing...' : '⚡ Push & Sync Rules'}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleNewSkill}>
            ➕ Create New Skill
          </button>
        )}
      </div>

      {/* Tabs selector */}
      <div style={{
        display: 'flex',
        gap: '12px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '8px',
        marginBottom: '4px'
      }}>
        <button
          onClick={() => setActivePageTab('rules')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: activePageTab === 'rules' ? 'var(--color-primary-glow)' : 'transparent',
            border: `1px solid ${activePageTab === 'rules' ? 'var(--border-color-active)' : 'transparent'}`,
            color: activePageTab === 'rules' ? 'var(--color-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.88rem',
            transition: 'var(--transition-smooth)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>⚙️</span>
          <span>Provider Rules</span>
        </button>
        <button
          onClick={() => setActivePageTab('skills')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: activePageTab === 'skills' ? 'var(--color-primary-glow)' : 'transparent',
            border: `1px solid ${activePageTab === 'skills' ? 'var(--border-color-active)' : 'transparent'}`,
            color: activePageTab === 'skills' ? 'var(--color-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.88rem',
            transition: 'var(--transition-smooth)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>🧩</span>
          <span>Universal Skills</span>
        </button>
      </div>

      {/* Conditional tab content */}
      {activePageTab === 'rules' && (
        <>
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
              <button className="btn" onClick={handleSyncRules} disabled={syncingRules} style={{ 
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
                    onClick={() => setActiveRuleTab(rule.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: activeRuleTab === rule.id ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                      border: `1px solid ${activeRuleTab === rule.id ? 'var(--border-color-active)' : 'var(--border-color)'}`,
                      color: activeRuleTab === rule.id ? 'var(--color-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: activeRuleTab === rule.id ? 600 : 500,
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
                  Edit {rules.find(r => r.id === activeRuleTab)?.filename || 'Rule Config'}
                </h3>
                {rules.length > 0 && (
                  <button className="btn btn-secondary" onClick={handleSaveRule} disabled={savingRule} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                    {savingRule ? 'Saving...' : '💾 Save Changes'}
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
                  value={ruleEditorContent}
                  onChange={(e) => setRuleEditorContent(e.target.value)}
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
        </>
      )}

      {activePageTab === 'skills' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: '32px',
          alignItems: 'start'
        }}>
          
          {/* Left Side: Skills list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
              Active Skills
            </p>
            {skills.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No skills created yet.</span>
            ) : (
              skills.map((skill) => (
                <div 
                  key={skill.id} 
                  onClick={() => selectSkill(skill)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: selectedSkillId === skill.id ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                    border: `1px solid ${selectedSkillId === skill.id ? 'var(--border-color-active)' : 'var(--border-color)'}`,
                    color: selectedSkillId === skill.id ? 'var(--color-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: selectedSkillId === skill.id ? 600 : 500,
                    fontSize: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{skill.name}</span>
                    {skill.auto_inject === 1 && <span style={{ fontSize: '0.65rem', padding: '2px 4px', background: 'var(--color-success)', color: 'var(--bg-main)', borderRadius: '3px', fontWeight: 600 }}>AUTO</span>}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>v{skill.version}</span>
                </div>
              ))
            )}
          </div>

          {/* Right Side: Skill editor */}
          <div className="glass-panel" style={{ padding: '24px', minHeight: '480px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Skill Name</label>
                <input 
                  type="text" 
                  value={skillName} 
                  onChange={(e) => setSkillName(e.target.value)} 
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Version</label>
                <input 
                  type="text" 
                  value={skillVersion} 
                  onChange={(e) => setSkillVersion(e.target.value)} 
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    outline: 'none',
                    fontSize: '0.9rem',
                    textAlign: 'center'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                id="autoInjectCheck"
                checked={skillAutoInject}
                onChange={(e) => setSkillAutoInject(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--color-primary)'
                }}
              />
              <label htmlFor="autoInjectCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                Auto-inject this skill into all provider system contexts during synchronization
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Instructions / Rules Markdown</label>
              <textarea
                value={skillContent}
                onChange={(e) => setSkillContent(e.target.value)}
                style={{
                  flex: 1,
                  width: '100%',
                  minHeight: '280px',
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {selectedSkillId && (
                <button className="btn btn-secondary" onClick={handleDeleteSkill} disabled={savingSkill} style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
                  {savingSkill ? 'Deleting...' : '🗑️ Delete Skill'}
                </button>
              )}
              <button className="btn btn-primary" onClick={handleSaveSkill} disabled={savingSkill}>
                {savingSkill ? 'Saving...' : '💾 Save Skill'}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

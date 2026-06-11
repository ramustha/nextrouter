'use client';

import React, { useState, useEffect } from 'react';

interface Skill {
  id: string;
  name: string;
  version: string;
  content: string;
  tags?: string;
  auto_inject: number;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0');
  const [content, setContent] = useState('');
  const [autoInject, setAutoInject] = useState(false);
  const [loading, setLoading] = useState(false);

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
    loadSkills();
  }, []);

  function selectSkill(skill: Skill) {
    setSelectedSkillId(skill.id);
    setName(skill.name);
    setVersion(skill.version);
    setContent(skill.content);
    setAutoInject(skill.auto_inject === 1);
  }

  function handleNew() {
    setSelectedSkillId('');
    setName('New Skill');
    setVersion('1.0');
    setContent('# New Universal Skill\n- Always follow naming conventions\n- ...');
    setAutoInject(false);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const isEdit = !!selectedSkillId;
      const res = await fetch('/api/skills', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSkillId,
          name,
          version,
          content,
          autoInject
        })
      });
      if (res.ok) {
        alert(isEdit ? 'Skill updated!' : 'New skill created!');
        await loadSkills();
      }
    } catch (e) {
      console.error('Failed to save skill:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedSkillId) return;
    if (!confirm('Are you sure you want to delete this skill?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/skills?id=${selectedSkillId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Skill deleted!');
        setSelectedSkillId('');
        setName('');
        setVersion('1.0');
        setContent('');
        setAutoInject(false);
        await loadSkills();
      }
    } catch (e) {
      console.error('Failed to delete skill:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Universal Skills</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Author reusable prompts and rules that auto-propagate to all AI providers
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          ➕ Create New Skill
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
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
                value={name} 
                onChange={(e) => setName(e.target.value)} 
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
                value={version} 
                onChange={(e) => setVersion(e.target.value)} 
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
              checked={autoInject}
              onChange={(e) => setAutoInject(e.target.checked)}
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
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
              <button className="btn btn-secondary" onClick={handleDelete} disabled={loading} style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
                {loading ? 'Deleting...' : '🗑️ Delete Skill'}
              </button>
            )}
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : '💾 Save Skill'}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}

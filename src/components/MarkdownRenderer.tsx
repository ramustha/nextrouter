import React, { useState, useEffect } from 'react';

interface MarkdownRendererProps {
  content: string;
  height?: string | number;
  style?: React.CSSProperties;
}

export function renderMarkdownToJSX(content: string): React.ReactNode[] {
  if (!content) return [];

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let keyIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${keyIndex++}`} style={{
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '12px 16px',
            margin: '8px 0',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.8rem',
            overflowX: 'auto',
            color: '#e2e8f0'
          }}>
            {codeBlockLang && (
              <div style={{ fontSize: '0.68rem', color: '#a0aec0', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                {codeBlockLang}
              </div>
            )}
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {codeBlockLines.join('\n')}
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().replace(/^```/, '');
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      elements.push(<div key={`empty-${keyIndex++}`} style={{ height: '8px' }} />);
      continue;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<hr key={`hr-${keyIndex++}`} style={{ border: 'none', borderTop: '1px solid var(--border-color, rgba(255,255,255,0.1))', margin: '12px 0' }} />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${keyIndex++}`} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary, #a855f7)', marginTop: '14px', marginBottom: '8px' }}>
          {parseInlineFormatting(trimmed.substring(2))}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${keyIndex++}`} style={{ fontSize: '1.1rem', fontWeight: 600, color: '#c084fc', marginTop: '12px', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }}>
          {parseInlineFormatting(trimmed.substring(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${keyIndex++}`} style={{ fontSize: '0.98rem', fontWeight: 600, color: '#e2e8f0', marginTop: '10px', marginBottom: '4px' }}>
          {parseInlineFormatting(trimmed.substring(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${keyIndex++}`} style={{ fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1', marginTop: '8px', marginBottom: '4px' }}>
          {parseInlineFormatting(trimmed.substring(5))}
        </h4>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={`bq-${keyIndex++}`} style={{
          borderLeft: '3px solid var(--color-primary, #a855f7)',
          paddingLeft: '12px',
          margin: '6px 0',
          color: '#cbd5e1',
          fontStyle: 'italic',
          background: 'rgba(168, 85, 247, 0.05)',
          borderRadius: '0 6px 6px 0',
          paddingTop: '4px',
          paddingBottom: '4px'
        }}>
          {parseInlineFormatting(trimmed.substring(2))}
        </blockquote>
      );
      continue;
    }

    // Checklist items: - [x], - [ ], - [/]
    const taskMatch = trimmed.match(/^-\s*`?\[([ x\/])\]`?\s*(.*)$/i);
    if (taskMatch) {
      const state = taskMatch[1].toLowerCase();
      const text = taskMatch[2];
      const isChecked = state === 'x';
      const isInProgress = state === '/';

      elements.push(
        <div key={`task-${keyIndex++}`} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          margin: '4px 0',
          fontSize: '0.88rem',
          color: isChecked ? 'var(--text-muted, #94a3b8)' : '#e2e8f0',
          textDecoration: isChecked ? 'line-through' : 'none'
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            background: isChecked ? 'rgba(34, 197, 94, 0.2)' : isInProgress ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.05)',
            border: isChecked ? '1px solid #22c55e' : isInProgress ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.2)',
            color: isChecked ? '#22c55e' : isInProgress ? '#eab308' : 'transparent',
            marginTop: '2px',
            flexShrink: 0
          }}>
            {isChecked ? '✓' : isInProgress ? '⏳' : ''}
          </span>
          <div>{parseInlineFormatting(text)}</div>
        </div>
      );
      continue;
    }

    // Bullet lists: - or *
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`list-${keyIndex++}`} style={{ display: 'flex', gap: '8px', margin: '3px 0 3px 8px', fontSize: '0.88rem', color: '#e2e8f0' }}>
          <span style={{ color: 'var(--color-primary, #a855f7)' }}>•</span>
          <div>{parseInlineFormatting(trimmed.substring(2))}</div>
        </div>
      );
      continue;
    }

    // Default Paragraph
    elements.push(
      <p key={`p-${keyIndex++}`} style={{ margin: '4px 0', fontSize: '0.88rem', lineHeight: '1.5', color: '#e2e8f0' }}>
        {parseInlineFormatting(trimmed)}
      </p>
    );
  }

  return elements;
}

function parseInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;

  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '1px 5px',
          borderRadius: '4px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.8rem',
          color: '#ec4899'
        }}>
          {part.substring(1, part.length - 1)}
        </code>
      );
    }
    return parseTextFormat(part, idx);
  });
}

function parseTextFormat(text: string, parentKey: number): React.ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const tokens: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(parseBoldItalic(text.substring(lastIndex, match.index), `t-${parentKey}-${lastIndex}`));
    }
    const label = match[1];
    const url = match[2];
    tokens.push(
      <a
        key={`link-${parentKey}-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#60a5fa', textDecoration: 'underline' }}
      >
        {label}
      </a>
    );
    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(parseBoldItalic(text.substring(lastIndex), `t-${parentKey}-${lastIndex}`));
  }

  return <React.Fragment key={parentKey}>{tokens}</React.Fragment>;
}

function parseBoldItalic(text: string, keyPrefix: string): React.ReactNode {
  const boldParts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  return boldParts.map((part, idx) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={`${keyPrefix}-b-${idx}`} style={{ fontWeight: 700, color: '#f8fafc' }}>{part.substring(2, part.length - 2)}</strong>;
    }
    return part;
  });
}

export function MarkdownRenderer({ content, height = '320px', style }: MarkdownRendererProps) {
  const [mode, setMode] = useState<'rendered' | 'raw'>('rendered');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: '#090d16',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overscrollBehavior: 'contain'
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '260px',
        ...style
      };

  const viewportHeight = isFullscreen ? 'calc(100vh - 80px)' : (typeof height === 'number' ? `${height}px` : height);

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {isFullscreen ? '📄 Document Preview (Fullscreen)' : ''}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setMode('rendered')}
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              borderRadius: '6px',
              border: mode === 'rendered' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
              background: mode === 'rendered' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.03)',
              color: mode === 'rendered' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: mode === 'rendered' ? 600 : 400
            }}
          >
            🎨 Rendered Preview
          </button>
          <button
            onClick={() => setMode('raw')}
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              borderRadius: '6px',
              border: mode === 'raw' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
              background: mode === 'raw' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.03)',
              color: mode === 'raw' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: mode === 'raw' ? 600 : 400
            }}
          >
            📝 Raw Markdown
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Open Fullscreen Preview'}
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: isFullscreen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)',
              color: isFullscreen ? '#fca5a5' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {isFullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      {mode === 'rendered' ? (
        <div style={{
          flex: 1,
          width: '100%',
          height: viewportHeight,
          padding: '20px',
          borderRadius: '8px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
          overflowY: 'auto',
          scrollbarWidth: 'thin'
        }}>
          {renderMarkdownToJSX(content)}
        </div>
      ) : (
        <textarea
          readOnly
          value={content || ''}
          style={{
            flex: 1,
            width: '100%',
            height: viewportHeight,
            padding: '20px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            lineHeight: '1.5',
            resize: 'none',
            outline: 'none',
            scrollbarWidth: 'thin'
          }}
        />
      )}
    </div>
  );
}

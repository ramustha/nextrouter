import { Message } from '../adapters/types';

/**
 * Strips code file bodies to keep only declarations/signatures,
 * reducing token usage significantly when sharing context.
 */
export function compressCode(filename: string, code: string): string {
  const ext = filename.split('.').pop() || '';
  
  if (['ts', 'tsx', 'js', 'jsx', 'json'].includes(ext)) {
    return compressJavaScriptLike(code);
  } else if (ext === 'py') {
    return compressPython(code);
  }
  
  // Return first 100 lines for unsupported file types as a simple fallback
  const lines = code.split('\n');
  if (lines.length > 100) {
    return lines.slice(0, 100).join('\n') + '\n\n// ... [remaining content pruned by NextRouter] ...';
  }
  return code;
}

function compressJavaScriptLike(code: string): string {
  const lines = code.split('\n');
  const compressed: string[] = [];
  
  let inImport = false;
  let importBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Keep imports (compacted if multiple lines)
    if (trimmed.startsWith('import ') || inImport) {
      if (trimmed.includes('from ') || trimmed.endsWith(';') || trimmed.includes("';") || trimmed.includes('";')) {
        importBlock.push(line);
        compressed.push(importBlock.join(' '));
        importBlock = [];
        inImport = false;
      } else {
        importBlock.push(line);
        inImport = true;
      }
      continue;
    }

    // 2. Keep class declarations, interface definitions, type aliases, function signatures
    const isDeclaration = 
      trimmed.startsWith('export ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('enum ') ||
      (trimmed.includes('function ') && trimmed.includes('(')) ||
      (trimmed.includes('=>') && (trimmed.includes('const ') || trimmed.includes('let ')));

    if (isDeclaration) {
      // Clean up body if on same line
      let cleanLine = line;
      if (trimmed.includes('{') && trimmed.endsWith('}')) {
        cleanLine = line.substring(0, line.indexOf('{') + 1) + ' /* ... */ }';
      } else if (trimmed.includes('{')) {
        cleanLine = line.substring(0, line.indexOf('{') + 1) + ' /* ... */ }';
      }
      compressed.push(cleanLine);
    }
  }

  if (compressed.length === 0) {
    return '// ... [implementation details pruned by NextRouter] ...';
  }

  return [
    `// NextRouter Compressed Outline: ${compressed.length} matching declarations`,
    ...compressed
  ].join('\n');
}

function compressPython(code: string): string {
  const lines = code.split('\n');
  const compressed: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('def ') || trimmed.startsWith('class ') || trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      compressed.push(line);
    }
  }

  return [
    '# NextRouter Compressed Outline',
    ...compressed
  ].join('\n');
}

/**
 * Summarizes messages array to yield a compact conversation state.
 */
export function summarizeConversation(messages: Message[]): string {
  if (messages.length === 0) return 'No conversation history.';
  
  const summaries: string[] = [];
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  summaries.push(`Conversation contains ${messages.length} total messages (${userMessages.length} User requests).`);
  
  if (userMessages.length > 0) {
    const firstRequest = userMessages[0].content.split('\n')[0];
    summaries.push(`- **Started with goal**: "${firstRequest.substring(0, 80)}${firstRequest.length > 80 ? '...' : ''}"`);
  }

  if (assistantMessages.length > 0) {
    const lastResponse = assistantMessages[assistantMessages.length - 1].content;
    // Find files mentioned in last response
    const fileMatches = lastResponse.match(/`([^`]+\.[a-zA-Z0-9]+)`/g);
    if (fileMatches && fileMatches.length > 0) {
      const uniqueFiles = Array.from(new Set(fileMatches)).map(f => f.replace(/`/g, ''));
      summaries.push(`- **Recently touched files**: ${uniqueFiles.join(', ')}`);
    }
  }

  return summaries.join('\n');
}

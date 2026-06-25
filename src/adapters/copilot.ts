import { ProviderAdapter, RuleFile, Session, ContextMetrics, HandoverPacket } from './types';
import { calculateRateLimits } from './utils';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class CopilotAdapter implements ProviderAdapter {
  id = 'copilot';
  name = 'GitHub Copilot';

  async detect(workspacePath: string): Promise<boolean> {
    return fs.existsSync(path.join(workspacePath, '.github', 'copilot-instructions.md'));
  }

  async getRules(workspacePath: string): Promise<RuleFile[]> {
    const copilotMdPath = path.join(workspacePath, '.github', 'copilot-instructions.md');
    if (!fs.existsSync(copilotMdPath)) return [];
    
    const content = fs.readFileSync(copilotMdPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const stats = fs.statSync(copilotMdPath);

    return [{
      id: `${this.id}-instructions`,
      filename: '.github/copilot-instructions.md',
      content,
      lastUpdatedAt: stats.mtime.toISOString(),
      hash
    }];
  }

  async writeRules(workspacePath: string, rules: RuleFile[]): Promise<void> {
    const rule = rules.find(r => r.filename === '.github/copilot-instructions.md');
    if (!rule) return;
    const destPath = path.join(workspacePath, '.github', 'copilot-instructions.md');
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(destPath, rule.content, 'utf8');
  }

  async getSessions(workspacePath: string): Promise<Session[]> {
    // Copilot doesn't store active conversation logs locally.
    return [];
  }

  async getContextSize(workspacePath: string): Promise<ContextMetrics> {
    const rateLimits = calculateRateLimits([], 100, 500);
    return {
      totalTokens: 0,
      totalFiles: 0,
      budgetUsedPercent: 0,
      contextWindowLimit: 0,
      ...rateLimits
    };
  }

  async getHandoverContext(workspacePath: string, sessionId?: string): Promise<HandoverPacket> {
    return {
      id: crypto.randomUUID(),
      sourceProviderId: this.id,
      sourceSessionId: sessionId,
      createdAt: new Date().toISOString(),
      summary: 'Handover from Copilot stub',
      files: [],
      rawMarkdown: '# Handover from Copilot stub\nConversation sync not supported by Copilot.'
    };
  }
}

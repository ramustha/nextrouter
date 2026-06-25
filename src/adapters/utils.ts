import { Session } from './types';
import { countTokens } from '../engine/tokenizer';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  'claude-code': { input: 3.00, output: 15.00 }, // Claude 3.5 Sonnet
  'cursor': { input: 2.50, output: 10.00 },      // GPT-4o
  'antigravity': { input: 1.25, output: 5.00 },   // Gemini 1.5 Pro
  'copilot': { input: 2.50, output: 10.00 }       // default completions pricing
};

// Cache calculated savings on globalThis to persist across reloads
const savingsCache = ((globalThis as any)._sessionSavingsCache) || new Map<string, { tokensSaved: number; costSaved: number; percentSaved: number; isActual: boolean }>();
(globalThis as any)._sessionSavingsCache = savingsCache;

export function calculateSessionSavings(
  session: any,
  handoverPacket?: any
) {
  const sessionLastActive = session.last_active_at || session.lastActiveAt || '';
  const cacheKey = `${session.id}_${sessionLastActive}_${handoverPacket ? 'actual' : 'estimate'}`;
  
  if (savingsCache.has(cacheKey)) {
    return savingsCache.get(cacheKey)!;
  }

  const fullTokens = session.token_count || session.tokenCount || 0;
  if (fullTokens <= 0) {
    const res = { tokensSaved: 0, costSaved: 0, percentSaved: 0, isActual: false };
    savingsCache.set(cacheKey, res);
    return res;
  }

  let briefingTokens = 0;
  let isActual = false;

  if (handoverPacket) {
    const markdown = handoverPacket.raw_markdown || handoverPacket.rawMarkdown;
    if (markdown) {
      briefingTokens = countTokens(markdown);
      isActual = true;
    }
  }

  if (!isActual) {
    // Estimate based on recent 6 messages
    const messages = session.messages || [];
    const recentMessages = messages.slice(-6);
    const recentText = recentMessages.map((m: any) => m.content || '').join('\n');
    briefingTokens = countTokens(recentText) + 250; // add baseline scaffolding tokens
  }

  const tokensSaved = Math.max(0, fullTokens - briefingTokens);
  
  const pricing = PROVIDER_PRICING[session.provider_id] || { input: 2.50 };
  const costSaved = (tokensSaved / 1000000) * pricing.input;

  const percentSaved = Math.round((tokensSaved / fullTokens) * 100);

  const result = {
    tokensSaved,
    costSaved: Math.round(costSaved * 100) / 100, // round to cents
    percentSaved: Math.min(100, Math.max(0, percentSaved)),
    isActual
  };

  savingsCache.set(cacheKey, result);
  return result;
}

export function calculateRateLimits(
  sessions: Session[],
  hourlyLimit: number,
  weeklyLimit: number
) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
 
  let hourlyMessagesUsed = 0;
  let weeklyMessagesUsed = 0;
  let oldestHourlyTimestamp = now.getTime();
  let oldestWeeklyTimestamp = now.getTime();

  for (const session of sessions) {
    if (!session.messages) continue;
    for (const msg of session.messages) {
      if (msg.role !== 'user' || !msg.timestamp) continue;
      const msgTime = new Date(msg.timestamp).getTime();

      if (msgTime >= oneHourAgo.getTime()) {
        hourlyMessagesUsed++;
        if (msgTime < oldestHourlyTimestamp) {
          oldestHourlyTimestamp = msgTime;
        }
      }

      if (msgTime >= oneWeekAgo.getTime()) {
        weeklyMessagesUsed++;
        if (msgTime < oldestWeeklyTimestamp) {
          oldestWeeklyTimestamp = msgTime;
        }
      }
    }
  }

  // Calculate minutes left until the oldest message in the hour rolls out of the window
  const hourlyResetMinutes = hourlyMessagesUsed > 0 
    ? Math.max(0, Math.round((60 * 60 * 1000 - (now.getTime() - oldestHourlyTimestamp)) / (60 * 1000)))
    : 0;

  // Calculate days left until the oldest message in the week rolls out of the window
  const weeklyResetDays = weeklyMessagesUsed > 0
    ? Math.max(0, Math.round((7 * 24 * 60 * 60 * 1000 - (now.getTime() - oldestWeeklyTimestamp)) / (24 * 60 * 60 * 1000) * 10) / 10)
    : 0;

  return {
    hourlyMessagesLimit: hourlyLimit,
    hourlyMessagesUsed,
    hourlyResetMinutes,
    weeklyMessagesLimit: weeklyLimit,
    weeklyMessagesUsed,
    weeklyResetDays
  };
}

// Cache resolved workspace roots in globalThis to persist across reloads
const workspaceRootCache = ((globalThis as any)._workspaceRootCache) || new Map<string, string | null>();
(globalThis as any)._workspaceRootCache = workspaceRootCache;

export function findWorkspaceRoot(filePath: string): string | null {
  if (!filePath) return null;
  const resolvedPath = path.resolve(filePath);
  if (workspaceRootCache.has(resolvedPath)) {
    return workspaceRootCache.get(resolvedPath)!;
  }

  let result: string | null = null;
  try {
    let currentDir = resolvedPath;
    if (fs.existsSync(currentDir) && !fs.statSync(currentDir).isDirectory()) {
      currentDir = path.dirname(currentDir);
    }
    const root = path.parse(currentDir).root;
    while (currentDir && currentDir !== root) {
      if (currentDir === os.homedir()) {
        currentDir = path.dirname(currentDir);
        continue;
      }
      if (
        fs.existsSync(path.join(currentDir, 'package.json')) ||
        fs.existsSync(path.join(currentDir, '.git')) ||
        fs.existsSync(path.join(currentDir, 'CLAUDE.md')) ||
        fs.existsSync(path.join(currentDir, '.cursorrules')) ||
        fs.existsSync(path.join(currentDir, '.claude'))
      ) {
        result = currentDir;
        break;
      }
      currentDir = path.dirname(currentDir);
    }
  } catch (e) {
    // Ignore filesystem errors and fallback to string parsing
  }

  if (!result) {
    // Fallback: heuristic path parsing
    const homedir = os.homedir();
    if (resolvedPath.startsWith(homedir)) {
      const relative = path.relative(homedir, resolvedPath);
      const segments = relative.split(path.sep);
      if (segments[0] === 'Work') {
        if (segments.length >= 3) {
          if (['growth', 'payment', 'personal'].includes(segments[1])) {
            if (segments[1] === 'growth' && ['traffic', 'seo', 'affiliate'].includes(segments[2])) {
              result = path.join(homedir, 'Work', segments[1], segments[2], segments[3] || '');
            } else {
              result = path.join(homedir, 'Work', segments[1], segments[2] || '');
            }
          } else {
            result = path.join(homedir, 'Work', segments[1] || '');
          }
        }
      }
      if (!result) {
        if (segments.length >= 2) {
          result = path.join(homedir, segments[0], segments[1]);
        } else if (segments.length === 1) {
          result = path.join(homedir, segments[0]);
        }
      }
    }
  }

  if (result === os.homedir() || result === '/' || result === path.parse(os.homedir()).root) {
    result = null;
  }

  workspaceRootCache.set(resolvedPath, result);
  return result;
}

export interface PlanFile {
  name: string;
  path: string;
  mtime: number;
}

export function findPlanFiles(workspacePath: string): PlanFile[] {
  const plans: PlanFile[] = [];
  if (!workspacePath || !fs.existsSync(workspacePath)) return plans;

  // 1. Check root plan files first
  const rootPlanNames = ['plan.md', 'PLAN.md', 'implementation_plan.md', 'IMPLEMENTATION_PLAN.md', 'task.md', 'TASK.md'];
  for (const name of rootPlanNames) {
    const fullPath = path.join(workspacePath, name);
    if (fs.existsSync(fullPath)) {
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          plans.push({
            name,
            path: fullPath,
            mtime: stat.mtimeMs
          });
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // 2. Scan recursively for subdirectories named "plans"
  const scanDir = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === '.next' || entry === 'out' || entry === 'dist' || entry === 'build') {
          continue;
        }
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (entry.toLowerCase() === 'plans') {
            try {
              const files = fs.readdirSync(fullPath);
              for (const f of files) {
                if (f.endsWith('.md') || f.endsWith('.MD')) {
                  const fp = path.join(fullPath, f);
                  const fStat = fs.statSync(fp);
                  if (fStat.isFile()) {
                    const relativeName = path.relative(workspacePath, fp);
                    if (!plans.some(p => p.path === fp)) {
                      plans.push({
                        name: relativeName,
                        path: fp,
                        mtime: fStat.mtimeMs
                      });
                    }
                  }
                }
              }
            } catch (e) {
              // ignore
            }
          } else {
            scanDir(fullPath);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  };

  scanDir(workspacePath);

  // Sort plans: most recently modified first
  return plans.sort((a, b) => b.mtime - a.mtime);
}



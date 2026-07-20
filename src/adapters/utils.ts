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

export function findSessionPlanFiles(session: Session | null | undefined, workspacePath: string): PlanFile[] {
  const plans: PlanFile[] = [];
  const addedPaths = new Set<string>();

  const addPlan = (name: string, fullPath: string, mtime?: number) => {
    if (!fs.existsSync(fullPath) || addedPaths.has(fullPath)) return;
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        addedPaths.add(fullPath);
        plans.push({
          name,
          path: fullPath,
          mtime: mtime || stat.mtimeMs
        });
      }
    } catch {}
  };

  // 1. Session Brain Artifact Plans (Priority 1)
  if (session && session.id) {
    const brainDirs = [
      path.join(os.homedir(), '.gemini', 'antigravity', 'brain', session.id),
      path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain', session.id)
    ];

    for (const brainDir of brainDirs) {
      if (fs.existsSync(brainDir)) {
        try {
          const files = fs.readdirSync(brainDir);
          for (const f of files) {
            if (f.endsWith('.md') && f !== '.DS_Store') {
              const fullPath = path.join(brainDir, f);
              addPlan(`[Session] ${f}`, fullPath);
            }
          }
        } catch {}
      }
    }
  }

  // 2. Scan Session Messages for Referenced Plan / Spec / Doc files (Priority 2)
  if (session && session.messages && session.messages.length > 0) {
    const fileRegex = /(?:file:\/\/\/|\b)([\w\-.\/]+\.(?:md|MD))\b/g;
    for (const msg of session.messages) {
      let match;
      fileRegex.lastIndex = 0;
      while ((match = fileRegex.exec(msg.content)) !== null) {
        const refPath = match[1];
        if (!refPath || refPath.includes('node_modules')) continue;
        
        let fullPath = refPath;
        if (!path.isAbsolute(refPath) && workspacePath) {
          fullPath = path.join(workspacePath, refPath);
        }

        if (fs.existsSync(fullPath)) {
          const relName = workspacePath ? path.relative(workspacePath, fullPath) : path.basename(fullPath);
          addPlan(relName, fullPath);
        }
      }
    }
  }

  // 3. Timeframe-Matched Workspace Plans (Priority 3)
  const allWorkspacePlans = findPlanFiles(workspacePath);
  if (session && session.startedAt && session.lastActiveAt) {
    const startMs = new Date(session.startedAt).getTime() - 15 * 60 * 1000;
    const endMs = new Date(session.lastActiveAt).getTime() + 15 * 60 * 1000;

    for (const wp of allWorkspacePlans) {
      if (wp.mtime >= startMs && wp.mtime <= endMs) {
        addPlan(wp.name, wp.path, wp.mtime);
      }
    }
  }

  // 4. Fallback: If no plans matched specific session criteria, include workspace plans
  if (plans.length === 0) {
    for (const wp of allWorkspacePlans) {
      addPlan(wp.name, wp.path, wp.mtime);
    }
  }

  return plans;
}

export function toImperative(verb: string): string {
  const v = verb.toLowerCase();
  const overrides: Record<string, string> = {
    creat: 'create',
    delet: 'delete',
    updat: 'update',
    writ: 'write',
    improv: 'improve',
    remov: 'remove',
    mak: 'make',
    us: 'use',
    replac: 'replace',
    compar: 'compare',
    generat: 'generate',
    migrat: 'migrate',
    configur: 'configure',
    resolv: 'resolve',
    clos: 'close',
    sav: 'save',
    handl: 'handle',
    tun: 'tune',
    defin: 'define',
    declar: 'declare',
    analyz: 'analyze',
    enabl: 'enable',
    disabl: 'disable',
    customiz: 'customize',
    optimiz: 'optimize',
    synchroniz: 'synchronize',
    restor: 'restore',
    prun: 'prune',
    ignor: 'ignore',
    initializ: 'initialize',
    serializ: 'serialize',
    validat: 'validate',
    pars: 'parse',
    merg: 'merge',
    manag: 'manage',
    chang: 'change',
    execut: 'execute',
    compil: 'compile',
    collaps: 'collapse',
    requir: 'require',
    prepar: 'prepare',
    releas: 'release',
    hid: 'hide',
    runn: 'run',
    putt: 'put',
    gett: 'get',
    shipp: 'ship',
    stopp: 'stop',
    formatt: 'format',
    committ: 'commit',
    cutt: 'cut',
    splitt: 'split',
    sett: 'set',
    mapp: 'map',
    logg: 'log',
    wrapp: 'wrap',
    yiel: 'yield'
  };

  const mapped = overrides[v];
  if (mapped) return mapped;

  // Handle double consonant for single-syllable doubling:
  // e.g. running -> runn -> run, committing -> committ -> commit
  if (v.length > 3 && v[v.length - 1] === v[v.length - 2]) {
    const doubleConsonants = ['n', 't', 'p', 'g', 'b', 'd'];
    const lastChar = v[v.length - 1];
    if (doubleConsonants.includes(lastChar)) {
      return v.slice(0, -1);
    }
  }

  // Fallback for verbs ending in typical silent-e stems
  if (v.endsWith('at') || 
      v.endsWith('iz') || 
      v.endsWith('us') || 
      v.endsWith('os') || 
      v.endsWith('ac') || 
      v.endsWith('uc') || 
      v.endsWith('ov') || 
      v.endsWith('ev') || 
      v.endsWith('iv') || 
      v.endsWith('ur') || 
      v.endsWith('or') || 
      v.endsWith('ut') ||
      v.endsWith('il') ||
      v.endsWith('al') ||
      v.endsWith('ul') ||
      v.endsWith('ol') ||
      (/[bcdfghjklmnpqrstvwxyz]l$/.test(v) && !v.endsWith('ll'))) {
    return v + 'e';
  }

  return v;
}

export function extractMeaningfulTitle(text: string): string {
  if (!text) return '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return '';

  // Filter out boilerplate lines first
  const nonBoilerplateLines = lines.filter(line => {
    if (line.startsWith('You are working in the') || 
        line.startsWith('You are a') || 
        line.startsWith('You are ') ||
        line.includes('is a Next.js') || 
        line.startsWith('**') ||
        line.startsWith('#') ||
        line.startsWith('```')) {
      return false;
    }
    return true;
  });

  const processLines = nonBoilerplateLines.length > 0 ? nonBoilerplateLines : lines;
  let rawTitle = '';

  // 1. Look for explicit job/task/goal lines
  for (const line of processLines) {
    const jobMatch = line.match(/^(?:your\s+)?(?:job|task|goal)\s*:\s*(.*)/i);
    if (jobMatch && jobMatch[1]) {
      rawTitle = cleanTitle(jobMatch[1]);
      break;
    }
  }

  // 2. Look for verbIng lines (e.g. "You are fixing...") and convert to imperative (e.g. "Fix...")
  if (!rawTitle) {
    for (const line of processLines) {
      const verbIngMatch = line.match(/^you\s+are\s+(\w+)ing\s+(.*)/i);
      if (verbIngMatch) {
        const verbStem = verbIngMatch[1];
        const imperativeVerb = toImperative(verbStem);
        const rest = verbIngMatch[2];
        const capitalizedVerb = imperativeVerb.charAt(0).toUpperCase() + imperativeVerb.slice(1);
        rawTitle = cleanTitle(`${capitalizedVerb} ${rest}`);
        break;
      }
    }
  }

  // 3. Look for lines starting with action verbs or Task markers
  if (!rawTitle) {
    for (const line of processLines) {
      if (line.match(/^(?:task\s+\d+|goal|instruction)\b/i)) {
        rawTitle = cleanTitle(line);
        break;
      }
      if (line.match(/^(?:rewrite|create|fix|add|implement|refactor|update|remove|delete|verify|check|test|improve)\b/i)) {
        rawTitle = cleanTitle(line);
        break;
      }
    }
  }

  // 4. Fallback: use first of processed lines
  if (!rawTitle) {
    rawTitle = cleanTitle(processLines[0]);
  }

  if (!rawTitle) return '';
  return rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
}

function cleanTitle(title: string): string {
  let cleaned = title
    .replace(/[*#_`]/g, '') // remove markdown backticks, stars, hashes
    .replace(/^[-+*\s]+/, '') // remove bullet points
    .trim();
  
  if (cleaned.length > 150) {
    cleaned = cleaned.substring(0, 150) + '...';
  }
  return cleaned;
}



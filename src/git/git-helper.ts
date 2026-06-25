import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface GitFileStatus {
  filepath: string;
  status: string; // 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'unknown'
  code: string; // porcelain code e.g. 'M', '??', 'A', 'D'
}

export interface GitStatusResult {
  isRepository: boolean;
  branch: string;
  files: GitFileStatus[];
}

export function isGitRepository(workspacePath: string): boolean {
  try {
    const output = execSync('git rev-parse --is-inside-work-tree', {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 1000
    });
    return output.trim() === 'true';
  } catch (e) {
    return false;
  }
}

export function getGitBranch(workspacePath: string): string {
  try {
    const output = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 1000
    });
    return output.trim();
  } catch (e) {
    return 'main';
  }
}

let cachedGitStatus: { [path: string]: { status: GitStatusResult; timestamp: number } } = {};

export function getGitStatus(workspacePath: string): GitStatusResult {
  const now = Date.now();
  const cached = cachedGitStatus[workspacePath];
  if (cached && (now - cached.timestamp < 10000)) {
    return cached.status;
  }

  if (!isGitRepository(workspacePath)) {
    const res = {
      isRepository: false,
      branch: '',
      files: [],
    };
    cachedGitStatus[workspacePath] = { status: res, timestamp: now };
    return res;
  }

  try {
    const branch = getGitBranch(workspacePath);
    const output = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf8',
    });

    const lines = output.split('\n').filter(line => line.trim() !== '');
    const files: GitFileStatus[] = lines.map(line => {
      // Line is usually "XY path/to/file" or "XY path/to/file -> new/path"
      const code = line.substring(0, 2);
      const filepath = line.substring(3).trim();
      
      const x = code[0];
      const y = code[1];

      let status = 'unknown';
      if (x === 'M' || y === 'M') {
        status = 'modified';
      } else if (x === '?' && y === '?') {
        status = 'untracked';
      } else if (x === 'A' || y === 'A') {
        status = 'added';
      } else if (x === 'D' || y === 'D') {
        status = 'deleted';
      } else if (x === 'R' || y === 'R') {
        status = 'renamed';
      }

      return {
        filepath,
        status,
        code: code.trim(),
      };
    });

    const res = {
      isRepository: true,
      branch,
      files,
    };
    cachedGitStatus[workspacePath] = { status: res, timestamp: now };
    return res;
  } catch (e) {
    const res = {
      isRepository: true,
      branch: 'unknown',
      files: [],
    };
    cachedGitStatus[workspacePath] = { status: res, timestamp: now };
    return res;
  }
}

export function getFileDiff(workspacePath: string, filepath: string): string {
  if (!isGitRepository(workspacePath)) {
    return '';
  }

  try {
    // Escape filename for shell safety
    const escapedFilepath = filepath.replace(/(["'$`\\])/g, '\\$1');
    
    // First check if it's untracked. If untracked, just read file content.
    const statusResult = getGitStatus(workspacePath);
    const fileStatus = statusResult.files.find(f => f.filepath === filepath);
    
    if (fileStatus && fileStatus.status === 'untracked') {
      const fullPath = path.join(workspacePath, filepath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Return a mock diff representing the new file additions
        return content.split('\n').map(line => `+${line}`).join('\n');
      }
      return '';
    }

    // Otherwise run git diff
    return execSync(`git diff HEAD -- "${escapedFilepath}"`, {
      cwd: workspacePath,
      encoding: 'utf8',
    });
  } catch (e: any) {
    console.error(`Error running git diff for ${filepath}:`, e);
    return `Error generating diff: ${e.message || e}`;
  }
}

export function getGitWorktrees(workspacePath: string): string[] {
  const resolvedWorkspace = path.resolve(workspacePath);
  if (!isGitRepository(resolvedWorkspace)) {
    return [resolvedWorkspace];
  }
  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: resolvedWorkspace,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000
    });
    const paths: string[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        const wtPath = line.substring(9).trim();
        if (wtPath) {
          paths.push(path.resolve(wtPath));
        }
      }
    }
    // Fallback if no worktrees parsed
    if (paths.length === 0) {
      paths.push(resolvedWorkspace);
    }
    return Array.from(new Set(paths)); // Deduplicate
  } catch (e) {
    return [resolvedWorkspace];
  }
}

import { getEncoding } from 'js-tiktoken';

export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    const enc = getEncoding('cl100k_base');
    const tokens = enc.encode(text).length;
    return tokens;
  } catch (e) {
    // Fallback: word-based token approximation (1.3 tokens per word)
    return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
  }
}

export interface ModelBudget {
  modelName: string;
  limit: number;
  provider: string;
}

export const MODEL_BUDGETS: ModelBudget[] = [
  { modelName: 'Gemini 1.5 Pro (Antigravity)', limit: 2000000, provider: 'antigravity' },
  { modelName: 'Gemini 1.5 Flash (Antigravity)', limit: 1000000, provider: 'antigravity' },
  { modelName: 'Claude 3.5 Sonnet (Claude Code)', limit: 200000, provider: 'claude-code' },
  { modelName: 'GPT-4o (Cursor)', limit: 128000, provider: 'cursor' },
  { modelName: 'Claude 3.5 Sonnet (Cursor)', limit: 200000, provider: 'cursor' },
  { modelName: 'GitHub Copilot Chat', limit: 32000, provider: 'copilot' }
];

export function getBudgetAnalysis(tokensUsed: number): Array<{
  modelName: string;
  provider: string;
  limit: number;
  used: number;
  percent: number;
  isOverLimit: boolean;
}> {
  return MODEL_BUDGETS.map(budget => {
    const percent = Math.min(100, Math.round((tokensUsed / budget.limit) * 100));
    return {
      modelName: budget.modelName,
      provider: budget.provider,
      limit: budget.limit,
      used: tokensUsed,
      percent,
      isOverLimit: tokensUsed > budget.limit
    };
  });
}

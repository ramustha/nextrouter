import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';

interface PriceTable {
  input: number;  // price per million tokens
  output: number; // price per million tokens
}

const PROVIDER_PRICING: Record<string, PriceTable> = {
  'claude-code': { input: 3.00, output: 15.00 }, // Claude 3.5 Sonnet
  'cursor': { input: 2.50, output: 10.00 },      // GPT-4o
  'antigravity': { input: 1.25, output: 5.00 },   // Gemini 1.5 Pro
  'copilot': { input: 2.50, output: 10.00 }       // default completions pricing
};

export async function GET() {
  const db = getDatabase();
  const sessions = db.sessions.all();
  const tokenTransactions = db.tokenUsage.all();

  const providerTotals: Record<string, { tokens: number; cost: number; name: string }> = {
    'claude-code': { tokens: 0, cost: 0, name: 'Claude Code' },
    'cursor': { tokens: 0, cost: 0, name: 'Cursor' },
    'antigravity': { tokens: 0, cost: 0, name: 'Antigravity' },
    'copilot': { tokens: 0, cost: 0, name: 'GitHub Copilot' }
  };

  let totalTokens = 0;
  let totalCost = 0;

  // Process logged token transactions
  for (const tx of tokenTransactions) {
    const pricing = PROVIDER_PRICING[tx.provider_id] || { input: 2.50, output: 10.00 };
    const rate = tx.direction === 'input' ? pricing.input : pricing.output;
    const cost = (tx.tokens / 1000000) * rate;

    if (providerTotals[tx.provider_id]) {
      providerTotals[tx.provider_id].tokens += tx.tokens;
      providerTotals[tx.provider_id].cost += cost;
    }
    
    totalTokens += tx.tokens;
    totalCost += cost;
  }

  // Fallback: if no transactions are logged but sessions exist, calculate from active sessions
  if (tokenTransactions.length === 0) {
    for (const session of sessions) {
      const pricing = PROVIDER_PRICING[session.provider_id] || { input: 2.50, output: 10.00 };
      
      // Assume 80% input, 20% output split as estimation
      const inputTokens = Math.round(session.token_count * 0.8);
      const outputTokens = session.token_count - inputTokens;
      
      const inputCost = (inputTokens / 1000000) * pricing.input;
      const outputCost = (outputTokens / 1000000) * pricing.output;
      const cost = inputCost + outputCost;

      if (providerTotals[session.provider_id]) {
        providerTotals[session.provider_id].tokens += session.token_count;
        providerTotals[session.provider_id].cost += cost;
      }

      totalTokens += session.token_count;
      totalCost += cost;
    }
  }

  const breakdown = Object.entries(providerTotals).map(([id, val]) => ({
    providerId: id,
    providerName: val.name,
    tokens: val.tokens,
    cost: Math.round(val.cost * 100) / 100 // round to cents
  }));

  return NextResponse.json({
    totalTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown
  });
}

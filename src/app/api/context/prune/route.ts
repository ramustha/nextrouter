import { NextResponse } from 'next/server';
import { compressCode } from '@/engine/compressor';
import { countTokens } from '@/engine/tokenizer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, content } = body;

    if (!content) {
      return NextResponse.json({ error: 'Missing code content' }, { status: 400 });
    }

    const name = filename || 'index.ts';
    const prunedContent = compressCode(name, content);
    
    const originalTokens = countTokens(content);
    const prunedTokens = countTokens(prunedContent);
    const savedTokens = Math.max(0, originalTokens - prunedTokens);
    const savedPercent = originalTokens > 0 
      ? Math.round((savedTokens / originalTokens) * 100) 
      : 0;

    return NextResponse.json({
      filename: name,
      prunedContent,
      originalTokens,
      prunedTokens,
      savedTokens,
      savedPercent
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Pruning failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getDatabase } from '@/store/database';
import { pullRules, pushRules, mergeRules } from '@/engine/rules-sync';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspacePath = searchParams.get('workspacePath') || process.cwd();

  // Pull latest rule configurations from provider files into database
  await pullRules(workspacePath);

  const db = getDatabase();
  const allRules = db.rules.all();
  const merged = mergeRules(allRules);

  // Drift Detection: check if rules are out of sync
  // We compare the base content (excluding auto-injected skills block)
  let drift = false;
  const driftDetails: string[] = [];
  
  if (allRules.length > 1) {
    const firstRuleBase = allRules[0].content
      .replace(/<!-- NEXTROUTER_SKILLS_START -->[\s\S]*<!-- NEXTROUTER_SKILLS_END -->/, '')
      .trim();
    
    for (let i = 1; i < allRules.length; i++) {
      const currentRuleBase = allRules[i].content
        .replace(/<!-- NEXTROUTER_SKILLS_START -->[\s\S]*<!-- NEXTROUTER_SKILLS_END -->/, '')
        .trim();
        
      if (firstRuleBase !== currentRuleBase) {
        drift = true;
        driftDetails.push(`${allRules[i].filename} is out of sync with ${allRules[0].filename}`);
      }
    }
  }

  return NextResponse.json({
    rules: allRules,
    merged,
    drift,
    driftDetails
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const workspacePath = body.workspacePath || process.cwd();
  const { action, rules } = body;

  const db = getDatabase();

  if (action === 'sync') {
    await pullRules(workspacePath);
    await pushRules(workspacePath);
    return NextResponse.json({ success: true, message: 'Rules synchronized successfully' });
  }

  if (action === 'update') {
    // Save updated rules to database
    if (Array.isArray(rules)) {
      for (const r of rules) {
        db.rules.upsert({
          id: r.id,
          provider_id: r.provider_id,
          filename: r.filename,
          content: r.content,
          last_updated_at: new Date().toISOString(),
          hash: crypto.randomUUID()
        });
      }
      
      // Write back to provider files
      await pushRules(workspacePath);
      return NextResponse.json({ success: true, message: 'Rules updated and pushed successfully' });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

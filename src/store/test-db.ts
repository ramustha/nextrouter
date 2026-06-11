import { getDatabase } from './database';
import { countTokens } from '../engine/tokenizer';
import { generateHandover } from '../engine/handover';
import { mergeRules } from '../engine/rules-sync';

async function runTests() {
  console.log('=== NextRouter Verification Tests ===');

  // Test 1: Database Initialization
  console.log('\nTest 1: Initializing JSON database...');
  const db = getDatabase();
  const providers = db.providers.all();
  console.log(`Successfully loaded ${providers.length} providers:`);
  providers.forEach(p => console.log(` - [${p.status.toUpperCase()}] ${p.name} (${p.id})`));
  
  if (providers.length !== 4) {
    throw new Error('Expected 4 default providers');
  }
  console.log('✓ Database initialization passed.');

  // Test 2: Token Counting (tiktoken)
  console.log('\nTest 2: Verifying token counting...');
  const text = 'Hello, world! This is a verification test for NextRouter context management.';
  const tokens = countTokens(text);
  console.log(`Text: "${text}"`);
  console.log(`Calculated tokens: ${tokens}`);
  if (tokens <= 0) {
    throw new Error('Token count should be greater than zero');
  }
  console.log('✓ Token counting passed.');

  // Test 3: Rule Merging
  console.log('\nTest 3: Testing rules merge utility...');
  const mockRules = [
    { id: '1', provider_id: 'claude-code', filename: 'CLAUDE.md', content: 'Use TypeScript only.', last_updated_at: new Date().toISOString(), hash: 'abc' },
    { id: '2', provider_id: 'cursor', filename: '.cursorrules', content: 'Keep functions short.', last_updated_at: new Date().toISOString(), hash: 'def' }
  ];
  const merged = mergeRules(mockRules);
  console.log('Merged output:\n' + merged);
  if (!merged.includes('CLAUDE.md') || !merged.includes('Use TypeScript only.')) {
    throw new Error('Merge output missing expected content');
  }
  console.log('✓ Rule merging passed.');

  // Test 4: Handover Compilation
  console.log('\nTest 4: Compiling mock handover briefing...');
  const mockSession = {
    id: 'mock-session-123',
    title: 'Implement Next.js API Routes',
    startedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    status: 'active' as const,
    tokenCount: 1500,
    messages: [
      { role: 'user' as const, content: 'Create a route in src/app/api/hello/route.ts' },
      { role: 'assistant' as const, content: 'Here is the typescript code for route.ts' }
    ]
  };
  const packet = generateHandover('claude-code', mockSession, 'cursor');
  console.log('Generated Handover Summary:', packet.summary);
  console.log('Handover Markdown preview:\n', packet.rawMarkdown.substring(0, 300) + '...\n');
  
  const savedPacket = db.handoverPackets.get(packet.id);
  if (!savedPacket) {
    throw new Error('Handover packet was not persisted to database');
  }
  console.log('✓ Handover compilation and persistence passed.');

  console.log('\n=== All Tests Passed Successfully! ===');
}

runTests().catch(e => {
  console.error('Test suite failed:', e);
  process.exit(1);
});

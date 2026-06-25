import { RuleFile } from '../adapters/types';
import { detectActiveProviders } from '../adapters/registry';
import { getDatabase, RuleRow } from '../store/database';
import { loadWorkspaceSkills } from '../skills/loader';
import fs from 'fs';
import path from 'path';
import { findPlanFiles } from '../adapters/utils';

export async function pullRules(workspacePath: string): Promise<RuleFile[]> {
  const db = getDatabase();
  const activeProviders = await detectActiveProviders(workspacePath);
  const pulledRules: RuleFile[] = [];
  const rulesToUpsert: any[] = [];

  for (const provider of activeProviders) {
    try {
      const providerRules = await provider.getRules(workspacePath);
      for (const rule of providerRules) {
        // Strip out any previously appended skills or plan blocks to preserve base content clean
        const cleanContent = rule.content
          .replace(/<!-- NEXTROUTER_SKILLS_START -->[\s\S]*<!-- NEXTROUTER_SKILLS_END -->/, '')
          .replace(/<!-- NEXTROUTER_PLAN_START -->[\s\S]*<!-- NEXTROUTER_PLAN_END -->/, '')
          .trim();

        // Accumulate for batch database insert
        rulesToUpsert.push({
          id: rule.id,
          provider_id: provider.id,
          filename: rule.filename,
          content: cleanContent,
          last_updated_at: rule.lastUpdatedAt,
          hash: rule.hash
        });
        
        pulledRules.push({
          ...rule,
          content: cleanContent
        });
      }
    } catch (e) {
      console.error(`Failed to pull rules from provider ${provider.id}:`, e);
    }
  }

  if (rulesToUpsert.length > 0) {
    db.rules.upsertMany(rulesToUpsert);
  }

  return pulledRules;
}

export async function pushRules(workspacePath: string): Promise<void> {
  const db = getDatabase();
  const activeProviders = await detectActiveProviders(workspacePath);
  
  // Load skills to auto-inject
  const localSkills = loadWorkspaceSkills(workspacePath);
  const autoInjectSkills = localSkills.filter(s => s.autoInject);

  let skillsAppendText = '';
  if (autoInjectSkills.length > 0) {
    skillsAppendText = [
      '\n\n<!-- NEXTROUTER_SKILLS_START -->',
      '## 🧩 NextRouter Auto-Injected Skills',
      ...autoInjectSkills.map(s => `### Skill: ${s.name} (v${s.version})\n${s.content}`),
      '<!-- NEXTROUTER_SKILLS_END -->'
    ].join('\n');
  }

  // Load active plan block (plan.md or implementation_plan.md)
  const planAppendText = loadPlanBlock(workspacePath);

  // Group rules in DB by provider
  const allDbRules = db.rules.all();

  for (const provider of activeProviders) {
    const providerRules = allDbRules.filter(r => r.provider_id === provider.id);
    if (providerRules.length === 0) continue;

    const rulesToSync: RuleFile[] = providerRules.map(r => ({
      id: r.id,
      filename: r.filename,
      content: r.content + planAppendText + skillsAppendText,
      lastUpdatedAt: r.last_updated_at,
      hash: r.hash
    }));

    try {
      await provider.writeRules(workspacePath, rulesToSync);
    } catch (e) {
      console.error(`Failed to push rules to provider ${provider.id}:`, e);
    }
  }
}

/**
 * Merges general system instructions into one unified rule file content
 * to make syncing configurations easier.
 */
export function mergeRules(rules: RuleRow[]): string {
  if (rules.length === 0) return '';
  
  const sections: string[] = [
    '# NextRouter Unified Rules & Instructions',
    'Generated dynamically by NextRouter. Synced across all active AI coding providers.',
    ''
  ];

  for (const rule of rules) {
    sections.push(`## 📄 Config from ${rule.provider_id} (${rule.filename})`);
    sections.push(rule.content);
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Reads any active plan file in the workspace
 */
function loadPlanBlock(workspacePath: string): string {
  const plans = findPlanFiles(workspacePath);
  if (plans.length > 0) {
    const activePlan = plans[0];
    try {
      const planContent = fs.readFileSync(activePlan.path, 'utf8').trim();
      if (planContent) {
        return [
          '\n\n<!-- NEXTROUTER_PLAN_START -->',
          `## 🎯 Workspace Active Plan (${activePlan.name})`,
          planContent,
          '<!-- NEXTROUTER_PLAN_END -->'
        ].join('\n');
      }
    } catch (err) {
      console.error(`Failed to read plan file ${activePlan.path}:`, err);
    }
  }
  return '';
}

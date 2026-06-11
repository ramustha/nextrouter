import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDatabase } from '../store/database';

export interface LocalSkill {
  name: string;
  version: string;
  autoInject: boolean;
  content: string;
  tags: string[];
}

export function loadWorkspaceSkills(workspacePath: string): LocalSkill[] {
  const skillsDir = path.join(workspacePath, 'skills');
  if (!fs.existsSync(skillsDir)) {
    // Create the directory if it doesn't exist
    try {
      fs.mkdirSync(skillsDir, { recursive: true });
      // Write a default README instruction inside
      fs.writeFileSync(
        path.join(skillsDir, 'README.md'),
        `# NextRouter Universal Skills
Drop any Markdown file (.md) in this folder.
You can optionally add YAML frontmatter:
\`\`\`yaml
---
name: "React Guidelines"
version: "1.2"
auto_inject: true
tags: ["react", "typescript"]
---
\`\`\`
These instructions will automatically merge into your AI assistant rule configurations during sync!
`,
        'utf8'
      );
    } catch (e) {
      console.error('Failed to create skills directory:', e);
    }
    return [];
  }

  const loadedSkills: LocalSkill[] = [];
  try {
    const files = fs.readdirSync(skillsDir);
    for (const file of files) {
      if (!file.endsWith('.md') || file === 'README.md') continue;
      
      const filePath = path.join(skillsDir, file);
      try {
        const rawContent = fs.readFileSync(filePath, 'utf8');
        const skill = parseSkillContent(file, rawContent);
        loadedSkills.push(skill);

        // Sync to Database
        const db = getDatabase();
        db.skills.upsert({
          id: crypto.createHash('md5').update(file).digest('hex'),
          name: skill.name,
          version: skill.version,
          content: skill.content,
          tags: JSON.stringify(skill.tags),
          auto_inject: skill.autoInject ? 1 : 0,
          last_updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error(`Error loading skill file ${file}:`, err);
      }
    }
  } catch (e) {
    console.error('Error scanning skills directory:', e);
  }

  return loadedSkills;
}

function parseSkillContent(filename: string, rawContent: string): LocalSkill {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = rawContent.match(frontmatterRegex);

  let name = path.basename(filename, '.md').replace(/-/g, ' ');
  let version = '1.0';
  let autoInject = false;
  let tags: string[] = [];
  let content = rawContent;

  if (match) {
    const yamlString = match[1];
    content = match[2];

    const lines = yamlString.split('\n');
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length < 2) continue;
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim().replace(/^['"]|['"]$/g, '');

      if (key === 'name') name = val;
      else if (key === 'version') version = val;
      else if (key === 'auto_inject') autoInject = val === 'true';
      else if (key === 'tags') {
        try {
          // simple array parse
          tags = JSON.parse(val.replace(/'/g, '"'));
        } catch (e) {
          tags = val.split(',').map(t => t.trim());
        }
      }
    }
  }

  return { name, version, autoInject, content, tags };
}

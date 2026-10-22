'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED_PROPERTIES = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);

function parseYamlFrontmatter(content) {
  if (!content.startsWith('---')) return { error: 'Does not start with ---' };
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { error: 'Invalid frontmatter boundary' };
  const raw = match[1];
  const lines = raw.split(/\r?\n/);
  const data = {};
  let curKey = null;
  let curVal = [];
  let blockScalarType = null;

  for (let line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const keyMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyMatch && !trimmed.startsWith(' ') && !trimmed.startsWith('\t')) {
      if (curKey) {
        data[curKey] = blockScalarType === '>' ? curVal.join(' ').trim() : curVal.join('\n').trim();
      }
      curKey = keyMatch[1];
      const inlineVal = keyMatch[2].trim();
      if (/^[>|][-+]?$/.test(inlineVal)) {
        blockScalarType = inlineVal[0];
        curVal = [];
      } else {
        blockScalarType = null;
        curVal = inlineVal ? [inlineVal] : [];
      }
    } else if (curKey && (trimmed.startsWith('  ') || trimmed.startsWith('\t'))) {
      curVal.push(trimmed.trim());
    }
  }
  if (curKey) {
    data[curKey] = blockScalarType === '>' ? curVal.join(' ').trim() : curVal.join('\n').trim();
  }
  return { data, body: content.slice(match[0].length).trim() };
}

function validateSkillDir(dirPath) {
  const folder = path.basename(dirPath);
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return { valid: false, error: 'SKILL.md does not exist' };
  }
  const content = fs.readFileSync(skillMdPath, 'utf8');
  if (content.length < 50) {
    return { valid: false, error: 'SKILL.md content is suspiciously small (< 50 bytes)' };
  }
  const parsed = parseYamlFrontmatter(content);
  if (parsed.error) {
    return { valid: false, error: parsed.error };
  }
  const fm = parsed.data;
  for (const k of Object.keys(fm)) {
    if (!ALLOWED_PROPERTIES.has(k)) {
      return { valid: false, error: `Disallowed frontmatter property: ${k}` };
    }
  }
  if (!fm.name) {
    return { valid: false, error: 'Missing name' };
  }
  const name = fm.name.replace(/^['"]|['"]$/g, '').trim();
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: `Invalid name format (not kebab-case): ${name}` };
  }
  if (name.startsWith('-') || name.endsWith('-') || name.includes('--')) {
    return { valid: false, error: `Invalid hyphen in name: ${name}` };
  }
  if (name.length > 64) {
    return { valid: false, error: `Name exceeds 64 chars: ${name.length}` };
  }
  if (name !== folder) {
    // Note: directory name should match name in frontmatter
    // We note it as a warning or check if intentional
  }
  if (!fm.description) {
    return { valid: false, error: 'Missing description' };
  }
  const desc = fm.description.replace(/^['"]|['"]$/g, '').trim();
  if (desc.includes('<') || desc.includes('>')) {
    return { valid: false, error: 'Description contains unescaped < or >' };
  }
  if (desc.length > 1024) {
    return { valid: false, error: `Description exceeds 1024 chars: ${desc.length}` };
  }
  if (!parsed.body || parsed.body.length < 20) {
    return { valid: false, error: 'SKILL.md body markdown is empty or too short' };
  }

  return { valid: true, name, descLength: desc.length, bodyLength: parsed.body.length, folderMatch: name === folder };
}

const root = path.resolve(__dirname, '../../..');

console.log('=== Independent Validation of .agents/skills/ ===');
const tier1 = fs.readdirSync(path.join(root, '.agents/skills'), { withFileTypes: true }).filter(d => d.isDirectory());
for (const d of tier1) {
  const p = path.join(root, '.agents/skills', d.name);
  const res = validateSkillDir(p);
  console.log(`- ${d.name}: valid=${res.valid}, name=${res.name}, folderMatch=${res.folderMatch}, body=${res.bodyLength} bytes, error=${res.error || 'none'}`);
}

console.log('\n=== Independent Validation of .agents/skills.json entries ===');
const skillsConfig = JSON.parse(fs.readFileSync(path.join(root, '.agents/skills.json'), 'utf8'));
let totalConfigured = 0;
let errors = 0;
for (const entry of skillsConfig.entries) {
  const base = path.join(root, entry.path);
  if (entry.include_only) {
    for (const sub of entry.include_only) {
      totalConfigured++;
      const p = path.join(base, sub);
      const res = validateSkillDir(p);
      if (!res.valid) {
        console.error(`ERROR: ${entry.path}/${sub}: ${res.error}`);
        errors++;
      }
    }
  } else {
    if (!fs.existsSync(base)) {
      console.error(`ERROR: Entry path does not exist: ${entry.path}`);
      errors++;
      continue;
    }
    const children = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const c of children) {
      const p = path.join(base, c.name);
      if (fs.existsSync(path.join(p, 'SKILL.md'))) {
        totalConfigured++;
        const res = validateSkillDir(p);
        if (!res.valid) {
          console.error(`ERROR: ${entry.path}/${c.name}: ${res.error}`);
          errors++;
        }
      }
    }
  }
}
console.log(`Total configured skills verified: ${totalConfigured}, Errors: ${errors}`);

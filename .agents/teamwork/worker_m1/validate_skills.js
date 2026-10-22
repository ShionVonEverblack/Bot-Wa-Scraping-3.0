'use strict';

/**
 * Automated Skill Frontmatter Validator
 * Validates SKILL.md files against official AgentSkills / Antigravity specification.
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_PROPERTIES = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);

function parseSimpleYaml(yamlText) {
  const result = {};
  const lines = yamlText.split(/\r?\n/);
  let currentKey = null;
  let currentValue = [];
  let blockScalarType = null; // '>' or '|'

  for (let line of lines) {
    line = line.trimEnd();
    if (!line || line.startsWith('#')) continue;

    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    // If it's a top-level key (no leading indentation)
    if (keyMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      if (currentKey) {
        if (blockScalarType === '>') {
          result[currentKey] = currentValue.join(' ').trim();
        } else if (blockScalarType === '|') {
          result[currentKey] = currentValue.join('\n').trim();
        } else {
          result[currentKey] = currentValue.join('\n').trim();
        }
      }
      currentKey = keyMatch[1];
      const inlineVal = keyMatch[2].trim();
      if (/^[>|][-+]?$/.test(inlineVal)) {
        blockScalarType = inlineVal[0];
        currentValue = [];
      } else {
        blockScalarType = null;
        currentValue = inlineVal ? [inlineVal] : [];
      }
    } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      currentValue.push(line.trim());
    }
  }

  if (currentKey) {
    if (blockScalarType === '>') {
      result[currentKey] = currentValue.join(' ').trim();
    } else if (blockScalarType === '|') {
      result[currentKey] = currentValue.join('\n').trim();
    } else {
      result[currentKey] = currentValue.join('\n').trim();
    }
  }

  return result;
}

function validateSkillMd(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File not found' };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.startsWith('---')) {
    return { valid: false, error: 'No YAML frontmatter found (must start with ---)' };
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { valid: false, error: 'Invalid frontmatter delimiter format' };
  }

  const frontmatterText = match[1];
  const frontmatter = parseSimpleYaml(frontmatterText);

  // Check unexpected keys
  for (const key of Object.keys(frontmatter)) {
    if (!ALLOWED_PROPERTIES.has(key)) {
      return { valid: false, error: `Unexpected key in frontmatter: ${key}` };
    }
  }

  // Check required name
  if (!frontmatter.name) {
    return { valid: false, error: "Missing required 'name' in frontmatter" };
  }

  let name = frontmatter.name.replace(/^['"]|['"]$/g, '').trim();
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: `Name '${name}' must be kebab-case (lowercase, digits, hyphens)` };
  }
  if (name.startsWith('-') || name.endsWith('-') || name.includes('--')) {
    return { valid: false, error: `Name '${name}' cannot start/end with hyphen or have consecutive hyphens` };
  }
  if (name.length > 64) {
    return { valid: false, error: `Name too long (${name.length} > 64)` };
  }

  // Check required description
  if (!frontmatter.description) {
    return { valid: false, error: "Missing required 'description' in frontmatter" };
  }

  let desc = frontmatter.description.replace(/^['"]|['"]$/g, '').trim();
  if (desc.includes('<') || desc.includes('>')) {
    return { valid: false, error: 'Description cannot contain angle brackets (< or >)' };
  }
  if (desc.length > 1024) {
    return { valid: false, error: `Description too long (${desc.length} > 1024)` };
  }

  return { valid: true, name, descLength: desc.length };
}

const rootDir = path.resolve(__dirname, '../../..');

// 1. Validate Tier-1 active skills in .agents/skills
console.log(`\n=== 1. VALIDATING TIER-1 ACTIVE SKILLS (.agents/skills) ===`);
const tier1Dir = path.join(rootDir, '.agents', 'skills');
const tier1Dirs = fs.readdirSync(tier1Dir, { withFileTypes: true }).filter(d => d.isDirectory());
let tier1Pass = 0;
let tier1Fail = 0;

for (const d of tier1Dirs) {
  const skillMd = path.join(tier1Dir, d.name, 'SKILL.md');
  const res = validateSkillMd(skillMd);
  if (res.valid) {
    console.log(`  ✓ [PASS] .agents/skills/${d.name} -> "${res.name}"`);
    tier1Pass++;
  } else {
    console.error(`  ✗ [FAIL] .agents/skills/${d.name} -> ${res.error}`);
    tier1Fail++;
  }
}
console.log(`Tier-1 Summary: ${tier1Pass} passed, ${tier1Fail} failed (Total: ${tier1Dirs.length})`);

// 2. Validate all configured skills in .agents/skills.json
console.log(`\n=== 2. VALIDATING CONFIGURED SKILLS IN .agents/skills.json ===`);
const skillsJsonPath = path.join(rootDir, '.agents', 'skills.json');
const skillsConfig = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf8'));

let configPass = 0;
let configFail = 0;
const configFailures = [];

for (const entry of skillsConfig.entries) {
  const entryPath = path.resolve(rootDir, entry.path);
  if (entry.include_only) {
    for (const inc of entry.include_only) {
      const skillMd = path.join(entryPath, inc, 'SKILL.md');
      const res = validateSkillMd(skillMd);
      if (res.valid) {
        configPass++;
      } else {
        configFail++;
        configFailures.push({ path: path.join(entry.path, inc), error: res.error });
      }
    }
  } else {
    if (fs.existsSync(entryPath)) {
      const children = fs.readdirSync(entryPath, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const child of children) {
        const skillMd = path.join(entryPath, child.name, 'SKILL.md');
        if (fs.existsSync(skillMd)) {
          const res = validateSkillMd(skillMd);
          if (res.valid) {
            configPass++;
          } else {
            configFail++;
            configFailures.push({ path: path.join(entry.path, child.name), error: res.error });
          }
        }
      }
    }
  }
}

console.log(`Configured Skills Summary: ${configPass} passed, ${configFail} failed (Total: ${configPass + configFail})`);
if (configFailures.length > 0) {
  console.log('Configured skill failures:');
  configFailures.forEach(f => console.log(`  - ${f.path}: ${f.error}`));
}

if (tier1Fail > 0 || configFail > 0) {
  console.error(`\nValidation failed with ${tier1Fail + configFail} errors.`);
  process.exit(1);
} else {
  console.log('\nAll configured skills and Tier-1 skills validated successfully with 0 errors!');
  process.exit(0);
}

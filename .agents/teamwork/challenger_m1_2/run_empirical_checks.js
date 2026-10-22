'use strict';

/**
 * Empirical Adversarial Challenger for Milestone 1: Skills Integration
 *
 * Tests:
 * 1. Strict YAML parsing of SKILL.md frontmatter using js-yaml.safeLoad
 * 2. Schema validation against official AgentSkills / Antigravity specification
 * 3. .agents/skills.json structure, path resolution, and collision detection
 * 4. Broken relative links, markdown links, images, and missing asset checks
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const ALLOWED_PROPERTIES = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);

const results = {
  tier1: { total: 0, passed: 0, failed: 0, errors: [] },
  configured: { total: 0, passed: 0, failed: 0, errors: [] },
  allRepository: { total: 0, passed: 0, failed: 0, errors: [] },
  skillsJson: { passed: true, errors: [], collisionWarnings: [] },
  linkChecks: { totalLinksChecked: 0, brokenLinks: [] }
};

/**
 * Extract and validate YAML frontmatter using js-yaml.safeLoad
 */
function validateSkillFile(filePath, options = {}) {
  const relPath = path.relative(ROOT_DIR, filePath);
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: `File not found: ${relPath}` };
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return { valid: false, error: `Read error: ${err.message}` };
  }

  // Check YAML frontmatter delimiter
  if (!content.startsWith('---')) {
    return { valid: false, error: `Does not start with '---' YAML frontmatter delimiter (${relPath})` };
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { valid: false, error: `Unclosed or malformed frontmatter delimiter '---' (${relPath})` };
  }

  const frontmatterRaw = match[1];
  let parsed;
  try {
    parsed = yaml.safeLoad(frontmatterRaw, { schema: yaml.DEFAULT_SAFE_SCHEMA });
  } catch (err) {
    return { valid: false, error: `Strict YAML parse error: ${err.message} (${relPath})` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: `Frontmatter must be a YAML mapping/object, got ${typeof parsed} (${relPath})` };
  }

  // Check allowed properties
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_PROPERTIES.has(key)) {
      return { valid: false, error: `Disallowed frontmatter key '${key}' (${relPath})` };
    }
  }

  // Name checks
  if (!parsed.name || typeof parsed.name !== 'string') {
    return { valid: false, error: `Missing or non-string 'name' (${relPath})` };
  }
  const name = parsed.name.trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    return { valid: false, error: `Name '${name}' is not strictly kebab-case lowercase (${relPath})` };
  }
  if (name.length > 64) {
    return { valid: false, error: `Name '${name}' exceeds 64 characters (${name.length}) (${relPath})` };
  }

  // Optional: check folder name alignment
  const parentDir = path.basename(path.dirname(filePath));
  if (options.checkFolderMatch && parentDir !== name) {
    return { valid: false, error: `Folder name '${parentDir}' does not match skill name '${name}' (${relPath})` };
  }

  // Description checks
  if (!parsed.description || typeof parsed.description !== 'string') {
    return { valid: false, error: `Missing or non-string 'description' (${relPath})` };
  }
  const desc = parsed.description.trim();
  if (desc.length === 0) {
    return { valid: false, error: `Empty description (${relPath})` };
  }
  if (desc.length > 1024) {
    return { valid: false, error: `Description length ${desc.length} exceeds 1024 chars (${relPath})` };
  }
  if (desc.includes('<') || desc.includes('>')) {
    return { valid: false, error: `Description contains raw unescaped angle brackets (${relPath})` };
  }

  return { valid: true, name, desc, parsed, body: content.slice(match[0].length) };
}

/**
 * Check relative links and asset references in SKILL.md
 */
function checkRelativeLinks(skillFilePath, bodyContent) {
  const skillDir = path.dirname(skillFilePath);
  const relSkillPath = path.relative(ROOT_DIR, skillFilePath);

  // Markdown links: [text](target) and ![alt](target)
  const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(bodyContent)) !== null) {
    let target = match[2].trim();
    results.linkChecks.totalLinksChecked++;

    // Ignore remote URLs, mailto, sidecar, anchors
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:') || target.startsWith('sidecar://')) {
      continue;
    }
    if (target.startsWith('#')) {
      continue;
    }

    // Strip hash anchors: e.g. "path/to/file.md#section" -> "path/to/file.md"
    const hashIdx = target.indexOf('#');
    let cleanTarget = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
    const queryIdx = cleanTarget.indexOf('?');
    if (queryIdx >= 0) cleanTarget = cleanTarget.slice(0, queryIdx);

    if (!cleanTarget) continue; // Pure anchor or empty

    // Resolve relative path
    const resolvedPath = path.resolve(skillDir, cleanTarget);
    if (!fs.existsSync(resolvedPath)) {
      results.linkChecks.brokenLinks.push({
        skillFile: relSkillPath,
        linkText: match[1],
        target: target,
        resolvedPath: path.relative(ROOT_DIR, resolvedPath)
      });
    }
  }
}

console.log('================================================================');
console.log('EMPIRICAL ADVERSARIAL CHALLENGER: MILESTONE 1 SKILLS INTEGRATION');
console.log('================================================================\n');

// ---------------------------------------------------------
// STEP 1: Verify .agents/skills.json structure & scan paths
// ---------------------------------------------------------
console.log('--- TEST SUITE 1: .agents/skills.json Configuration ---');
const skillsJsonPath = path.join(ROOT_DIR, '.agents', 'skills.json');
let skillsConfig;

if (!fs.existsSync(skillsJsonPath)) {
  results.skillsJson.passed = false;
  results.skillsJson.errors.push('.agents/skills.json does not exist');
} else {
  try {
    const rawJson = fs.readFileSync(skillsJsonPath, 'utf8');
    skillsConfig = JSON.parse(rawJson);
  } catch (err) {
    results.skillsJson.passed = false;
    results.skillsJson.errors.push(`JSON parse error: ${err.message}`);
  }
}

const discoveredSkills = new Map(); // skillName -> [paths]

if (skillsConfig && Array.isArray(skillsConfig.entries)) {
  console.log(`Found ${skillsConfig.entries.length} entries in .agents/skills.json`);
  for (let i = 0; i < skillsConfig.entries.length; i++) {
    const entry = skillsConfig.entries[i];
    if (!entry.path || typeof entry.path !== 'string') {
      results.skillsJson.errors.push(`Entry #${i} missing valid 'path'`);
      continue;
    }
    const absPath = path.resolve(ROOT_DIR, entry.path);
    if (!fs.existsSync(absPath)) {
      results.skillsJson.errors.push(`Entry #${i} path does not exist: ${entry.path}`);
      continue;
    }

    if (entry.include_only) {
      if (!Array.isArray(entry.include_only)) {
        results.skillsJson.errors.push(`Entry #${i} (${entry.path}) include_only is not an array`);
        continue;
      }
      for (const item of entry.include_only) {
        const itemDir = path.join(absPath, item);
        const itemSkillMd = path.join(itemDir, 'SKILL.md');
        if (!fs.existsSync(itemDir)) {
          results.skillsJson.errors.push(`Entry #${i} include_only directory does not exist: ${path.join(entry.path, item)}`);
        } else if (!fs.existsSync(itemSkillMd)) {
          results.skillsJson.errors.push(`Entry #${i} missing SKILL.md in: ${path.join(entry.path, item)}`);
        } else {
          // Track for collisions
          if (!discoveredSkills.has(item)) discoveredSkills.set(item, []);
          discoveredSkills.get(item).push(path.join(entry.path, item));
        }
      }
    } else {
      const items = fs.readdirSync(absPath, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const item of items) {
        const itemSkillMd = path.join(absPath, item.name, 'SKILL.md');
        if (fs.existsSync(itemSkillMd)) {
          if (!discoveredSkills.has(item.name)) discoveredSkills.set(item.name, []);
          discoveredSkills.get(item.name).push(path.join(entry.path, item.name));
        }
      }
    }
  }

  // Check for skill collisions
  for (const [sName, pathsList] of discoveredSkills.entries()) {
    if (pathsList.length > 1) {
      results.skillsJson.collisionWarnings.push({
        skillName: sName,
        instances: pathsList
      });
    }
  }
} else if (results.skillsJson.passed) {
  results.skillsJson.passed = false;
  results.skillsJson.errors.push('.agents/skills.json missing "entries" array');
}

console.log(`Total unique configured skills discovered: ${discoveredSkills.size}`);
console.log(`Collisions / Shadows detected: ${results.skillsJson.collisionWarnings.length}`);
if (results.skillsJson.collisionWarnings.length > 0) {
  results.skillsJson.collisionWarnings.forEach(c => {
    console.log(`  [COLLISION/SHADOW] '${c.skillName}' defined in ${c.instances.length} locations:`);
    c.instances.forEach(p => console.log(`    - ${p}`));
  });
}
if (results.skillsJson.errors.length > 0) {
  results.skillsJson.passed = false;
  results.skillsJson.errors.forEach(e => console.error(`  [CONFIG ERROR] ${e}`));
} else {
  console.log('✓ .agents/skills.json syntax and path verification PASSED');
}


// ---------------------------------------------------------
// STEP 2: Strict YAML Frontmatter Validation - Tier-1 Skills
// ---------------------------------------------------------
console.log('\n--- TEST SUITE 2: Tier-1 Active Skills (.agents/skills) ---');
const tier1Path = path.join(ROOT_DIR, '.agents', 'skills');
if (fs.existsSync(tier1Path)) {
  const dirs = fs.readdirSync(tier1Path, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const d of dirs) {
    results.tier1.total++;
    const skillMd = path.join(tier1Path, d.name, 'SKILL.md');
    const res = validateSkillFile(skillMd, { checkFolderMatch: true });
    if (res.valid) {
      results.tier1.passed++;
      console.log(`  ✓ [PASS] ${d.name} -> name: "${res.name}" (desc: ${res.desc.length} chars)`);
      checkRelativeLinks(skillMd, res.body);
    } else {
      results.tier1.failed++;
      results.tier1.errors.push({ path: path.join('.agents/skills', d.name), error: res.error });
      console.error(`  ✗ [FAIL] ${d.name} -> ${res.error}`);
    }
  }
}
console.log(`Tier-1 Results: ${results.tier1.passed}/${results.tier1.total} passed`);


// ---------------------------------------------------------
// STEP 3: Strict YAML Frontmatter Validation - Configured Skills
// ---------------------------------------------------------
console.log('\n--- TEST SUITE 3: All Configured Skills in .agents/skills.json ---');
if (skillsConfig && Array.isArray(skillsConfig.entries)) {
  for (const entry of skillsConfig.entries) {
    const entryPath = path.resolve(ROOT_DIR, entry.path);
    if (!fs.existsSync(entryPath)) continue;

    const targets = [];
    if (entry.include_only) {
      entry.include_only.forEach(inc => targets.push(path.join(entryPath, inc, 'SKILL.md')));
    } else {
      const children = fs.readdirSync(entryPath, { withFileTypes: true }).filter(d => d.isDirectory());
      children.forEach(c => targets.push(path.join(entryPath, c.name, 'SKILL.md')));
    }

    for (const t of targets) {
      if (!fs.existsSync(t)) continue;
      results.configured.total++;
      const res = validateSkillFile(t, { checkFolderMatch: true });
      if (res.valid) {
        results.configured.passed++;
        checkRelativeLinks(t, res.body);
      } else {
        results.configured.failed++;
        results.configured.errors.push({ path: path.relative(ROOT_DIR, t), error: res.error });
      }
    }
  }
}
console.log(`Configured Skills Results: ${results.configured.passed}/${results.configured.total} passed, ${results.configured.failed} failed`);
if (results.configured.errors.length > 0) {
  results.configured.errors.forEach(e => console.error(`  ✗ [FAIL] ${e.path}: ${e.error}`));
}


// ---------------------------------------------------------
// STEP 4: Relative Links & Asset Existence Check
// ---------------------------------------------------------
console.log('\n--- TEST SUITE 4: Broken Relative Links & Missing Assets ---');
console.log(`Total relative markdown links checked across active/configured skills: ${results.linkChecks.totalLinksChecked}`);
console.log(`Broken links found: ${results.linkChecks.brokenLinks.length}`);
if (results.linkChecks.brokenLinks.length > 0) {
  results.linkChecks.brokenLinks.forEach(b => {
    console.error(`  ✗ [BROKEN LINK] in ${b.skillFile}: target "${b.target}" -> missing at "${b.resolvedPath}"`);
  });
} else {
  console.log('✓ All relative links and asset references resolve successfully!');
}


// ---------------------------------------------------------
// STEP 5: Repository-Wide SKILL.md Census & Strict YAML Parsing
// ---------------------------------------------------------
console.log('\n--- TEST SUITE 5: Repository-Wide SKILL.md Strict YAML Audit ---');
function findSkillFiles(dir) {
  let fileList = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      fileList = fileList.concat(findSkillFiles(full));
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      fileList.push(full);
    }
  }
  return fileList;
}

const allSkillFiles = findSkillFiles(ROOT_DIR);
console.log(`Found ${allSkillFiles.length} total SKILL.md files in workspace.`);
for (const sf of allSkillFiles) {
  results.allRepository.total++;
  const res = validateSkillFile(sf, { checkFolderMatch: false });
  if (res.valid) {
    results.allRepository.passed++;
  } else {
    results.allRepository.failed++;
    results.allRepository.errors.push({ path: path.relative(ROOT_DIR, sf), error: res.error });
  }
}
console.log(`Repository-wide Strict YAML Parsing: ${results.allRepository.passed}/${results.allRepository.total} passed (${results.allRepository.failed} failures)`);
if (results.allRepository.failed > 0) {
  console.log(`First 10 repository-wide failure samples:`);
  results.allRepository.errors.slice(0, 10).forEach(e => console.log(`  - ${e.path}: ${e.error}`));
}


// ---------------------------------------------------------
// SUMMARY & VERDICT
// ---------------------------------------------------------
console.log('\n================================================================');
console.log('FINAL CHALLENGER VERDICT');
console.log('================================================================');
const criticalErrors = [];
if (results.tier1.failed > 0) criticalErrors.push(`Tier-1 skills have ${results.tier1.failed} failures`);
if (results.configured.failed > 0) criticalErrors.push(`Configured skills have ${results.configured.failed} failures`);
if (!results.skillsJson.passed) criticalErrors.push(`skills.json has configuration errors`);
if (results.linkChecks.brokenLinks.length > 0) criticalErrors.push(`Found ${results.linkChecks.brokenLinks.length} broken relative links in active/configured skills`);

if (criticalErrors.length > 0) {
  console.log('VERDICT: REQUEST_CHANGES');
  console.log('Reason:');
  criticalErrors.forEach(c => console.log(`  - ${c}`));
} else {
  console.log('VERDICT: APPROVE');
  console.log('Reason: 100% of Tier-1 and configured skills parse cleanly with strict YAML, skills.json paths are valid, and zero broken relative links were detected in active/configured skills.');
}

// Dump detailed test results to JSON
fs.writeFileSync(path.join(__dirname, 'test_results.json'), JSON.stringify(results, null, 2), 'utf8');
console.log(`\nDetailed test results saved to: ${path.join(__dirname, 'test_results.json')}`);

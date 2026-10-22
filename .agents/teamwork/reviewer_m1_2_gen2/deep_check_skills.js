'use strict';
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..');
const config = JSON.parse(fs.readFileSync(path.join(rootDir, '.agents', 'skills.json'), 'utf8'));

let checked = 0;
let emptySkills = [];
let invalidNames = [];
let invalidDescriptions = [];
let suspiciousDescriptions = [];

function checkSkill(skillPath, nameHint) {
  checked++;
  const stat = fs.statSync(skillPath);
  if (stat.size < 50) {
    emptySkills.push({ path: skillPath, size: stat.size });
  }
  const content = fs.readFileSync(skillPath, 'utf8');
  if (!content.startsWith('---')) {
    invalidDescriptions.push({ path: skillPath, reason: 'No frontmatter start ---' });
    return;
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    invalidDescriptions.push({ path: skillPath, reason: 'Invalid frontmatter delimiter' });
    return;
  }
  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  if (!nameMatch) {
    invalidNames.push({ path: skillPath, reason: 'Missing name' });
  } else {
    const rawName = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
    if (!/^[a-z0-9-]+$/.test(rawName)) {
      invalidNames.push({ path: skillPath, name: rawName, reason: 'Not kebab-case' });
    }
  }
  if (!descMatch) {
    // could be multiline description
    const multiDescMatch = fm.match(/^description:\s*([>|][-+]?[\s\S]*?)(?=^[a-zA-Z0-9_-]+:|$)/m);
    if (!multiDescMatch) {
      invalidDescriptions.push({ path: skillPath, reason: 'Missing description' });
    }
  }
  // Check if body content exists after frontmatter
  const body = content.slice(match[0].length).trim();
  if (body.length < 50) {
    suspiciousDescriptions.push({ path: skillPath, bodyLength: body.length });
  }
}

config.entries.forEach(e => {
  const p = path.resolve(rootDir, e.path);
  if (e.include_only) {
    e.include_only.forEach(inc => {
      checkSkill(path.join(p, inc, 'SKILL.md'), inc);
    });
  } else {
    const items = fs.readdirSync(p, { withFileTypes: true });
    items.filter(d => d.isDirectory() && fs.existsSync(path.join(p, d.name, 'SKILL.md'))).forEach(d => {
      checkSkill(path.join(p, d.name, 'SKILL.md'), d.name);
    });
  }
});

console.log(`Checked ${checked} skills.`);
console.log(`Empty/tiny skills (<50 bytes total): ${emptySkills.length}`);
console.log(`Invalid names: ${invalidNames.length}`);
console.log(`Invalid descriptions: ${invalidDescriptions.length}`);
console.log(`Suspicious tiny bodies (<50 bytes): ${suspiciousDescriptions.length}`);

if (emptySkills.length || invalidNames.length || invalidDescriptions.length || suspiciousDescriptions.length) {
  console.log('Issues found:');
  console.log({ emptySkills, invalidNames, invalidDescriptions, suspiciousDescriptions });
}

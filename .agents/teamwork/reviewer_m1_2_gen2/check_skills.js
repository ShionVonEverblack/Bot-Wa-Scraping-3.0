'use strict';
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..');
const config = JSON.parse(fs.readFileSync(path.join(rootDir, '.agents', 'skills.json'), 'utf8'));

let totalSkills = 0;
config.entries.forEach((e, i) => {
  const p = path.resolve(rootDir, e.path);
  const exists = fs.existsSync(p);
  let count = 0;
  if (exists) {
    if (e.include_only) {
      count = e.include_only.filter(inc => fs.existsSync(path.join(p, inc, 'SKILL.md'))).length;
    } else {
      const items = fs.readdirSync(p, { withFileTypes: true });
      count = items.filter(d => d.isDirectory() && fs.existsSync(path.join(p, d.name, 'SKILL.md'))).length;
    }
  }
  totalSkills += count;
  console.log(`Entry ${i}: ${e.path} -> exists: ${exists}, valid SKILL.md count: ${count}`);
});

console.log(`Total configured discoverable skills: ${totalSkills}`);

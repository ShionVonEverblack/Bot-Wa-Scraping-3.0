'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');

function findJs(dir) {
  let res = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) res = res.concat(findJs(full));
    else if (e.name.endsWith('.js')) res.push(full);
  }
  return res;
}

const root = path.resolve(__dirname, '../../..');
const srcDir = path.join(root, 'src');
const jsFiles = findJs(srcDir);
console.log(`Found ${jsFiles.length} files in src/`);

const issues = [];
for (const file of jsFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const code = `
    try {
      require('./${rel}');
      process.exit(0);
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        console.error('MODULE_NOT_FOUND:', e.message);
        process.exit(2);
      }
      // If it throws another error because it expects config/runtime, that's not MODULE_NOT_FOUND
      process.exit(0);
    }
  `;
  const res = cp.spawnSync('node', ['-e', code], { cwd: root, timeout: 4000 });
  if (res.status === 2) {
    issues.push({ file: rel, error: res.stderr.toString().trim() });
  }
}

console.log(`MODULE_NOT_FOUND count: ${issues.length}`);
if (issues.length > 0) {
  console.log('Issues:', issues);
} else {
  console.log('All files loaded without MODULE_NOT_FOUND!');
}

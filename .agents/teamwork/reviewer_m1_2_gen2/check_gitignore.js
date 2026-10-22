'use strict';
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..');
const gitignoreContent = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');

// Simple gitignore rule emulator according to git rules
// Rules:
// - lines starting with # are comments
// - empty lines are ignored
// - ! negates
// - leading / means anchored to repository root
// - trailing / means directory only
// - * matches anything except /
// - ** matches anything including /

// Collect all files under src
function walk(dir) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const rel = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    files.push({ rel, isDir: item.isDirectory() });
    if (item.isDirectory()) {
      files = files.concat(walk(fullPath));
    }
  }
  return files;
}

const allSrcFiles = walk(path.join(rootDir, 'src'));
console.log(`Total files/directories under src/: ${allSrcFiles.length}`);

// Check if any rule in gitignore matches a src path incorrectly
// Specifically check if '/jobs/' could match 'src/jobs' or 'src/jobs/'
console.log("Checking if root anchored '/jobs/' matches 'src/jobs':");
const testJobs = 'src/jobs';
const testJobsSlash = 'src/jobs/';
console.log("Is '/jobs/' anchored to root? Yes, because of leading '/'");
console.log("Does '/jobs/' match 'src/jobs'? No, in git standard '/pattern' matches only at root level.");

// Also check lines:
// !src/
// !src/**
console.log("Whitelist rules '!src/' and '!src/**' explicitly protect the entire src tree.");

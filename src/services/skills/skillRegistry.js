'use strict';

/**
 * @fileoverview Agent Skills Registry & Loader.
 * Discovers and parses all installed SKILL.md files across `skills/` and `.agents/skills/`
 * (including Andrej Karpathy Guidelines, Obra Superpowers, Matt Pocock Skills,
 * Everything Claude Code (ECC), Anthropic Official Skills, and Bot WA Scraping 3.0 skills).
 * @module services/skills/skillRegistry
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../monitor/logger');

const log = createLogger('services:skills');

/** @type {Map<string, { id: string, name: string, description: string, category: string, filePath: string, content: string }>} */
const skillsMap = new Map();

/** @type {Map<string, string>} userId -> active skillId */
const activeUserSkills = new Map();

let isLoaded = false;

/**
 * Parse YAML frontmatter (`name`, `description`) and markdown body from a SKILL.md string.
 * @param {string} raw
 * @param {string} fallbackName
 * @returns {{ name: string, description: string, body: string }}
 */
function parseSkillMarkdown(raw, fallbackName = 'skill') {
  if (!raw || typeof raw !== 'string') {
    return { name: fallbackName, description: '', body: '' };
  }

  let name = fallbackName;
  let description = '';
  let body = raw;

  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fmMatch) {
    const frontmatter = fmMatch[1];
    body = fmMatch[2].trim();

    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
      name = nameMatch[1].replace(/^["']|["']$/g, '').trim();
    }

    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) {
      description = descMatch[1].replace(/^["']|["']$/g, '').trim();
    }
  }

  if (!description) {
    const firstParagraph = body
      .split(/\r?\n/)
      .map(l => l.trim())
      .find(l => l.length > 10 && !l.startsWith('#'));
    description = firstParagraph ? firstParagraph.slice(0, 180) : `Agent skill: ${name}`;
  }

  return { name, description, body };
}

/**
 * Recursively scan a directory for `SKILL.md` files (up to maxDepth).
 * @param {string} dir
 * @param {number} [depth=0]
 * @param {number} [maxDepth=4]
 * @returns {string[]}
 */
function findSkillFiles(dir, depth = 0, maxDepth = 4) {
  if (depth > maxDepth || !fs.existsSync(dir)) return [];
  const results = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findSkillFiles(fullPath, depth + 1, maxDepth));
      } else if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') {
        results.push(fullPath);
      }
    }
  } catch { /* ignore read errors */ }

  return results;
}

/**
 * Load all skills from the project's `skills/` and `.agents/skills/` directories.
 * @param {boolean} [force=false]
 * @returns {number} Count of loaded skills
 */
function loadSkills(force = false) {
  if (isLoaded && !force) return skillsMap.size;
  skillsMap.clear();

  const repoRoot = path.resolve(__dirname, '../../..');
  const candidateRoots = [
    { dir: path.join(repoRoot, 'skills'), defaultCategory: 'general' },
    { dir: path.join(repoRoot, '.agents', 'skills'), defaultCategory: 'agents' },
  ];

  for (const { dir: rootDir, defaultCategory } of candidateRoots) {
    const files = findSkillFiles(rootDir, 0, 4);

    for (const filePath of files) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parentFolder = path.basename(path.dirname(filePath));
        const relParts = path.relative(rootDir, filePath).split(path.sep);
        const category = relParts.length > 1 ? relParts[0] : defaultCategory;

        const parsed = parseSkillMarkdown(raw, parentFolder);
        const id = parsed.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');

        if (!skillsMap.has(id)) {
          skillsMap.set(id, {
            id,
            name: parsed.name,
            description: parsed.description,
            category,
            filePath,
            content: parsed.body,
          });
        }
      } catch (err) {
        log.debug(`Skipped skill file ${filePath}`, { error: err.message });
      }
    }
  }

  isLoaded = true;
  log.info(`Loaded ${skillsMap.size} agent skills across skills/ and .agents/skills/`);
  return skillsMap.size;
}

/**
 * List all available skills, optionally filtered by query or category.
 * @param {string} [query='']
 * @returns {Array<{ id: string, name: string, description: string, category: string }>}
 */
function listSkills(query = '') {
  loadSkills();
  const q = (query || '').trim().toLowerCase();
  const all = Array.from(skillsMap.values());

  const filtered = q
    ? all.filter(
        s =>
          s.id.includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      )
    : all;

  return filtered.map(({ id, name, description, category }) => ({
    id,
    name,
    description,
    category,
  }));
}

/**
 * Get full details of a skill by ID or name.
 * @param {string} idOrName
 * @returns {Object|null}
 */
function getSkill(idOrName) {
  loadSkills();
  if (!idOrName) return null;
  const key = idOrName.trim().toLowerCase();

  if (skillsMap.has(key)) return skillsMap.get(key);

  for (const skill of skillsMap.values()) {
    if (skill.name.toLowerCase() === key || skill.id.includes(key)) {
      return skill;
    }
  }
  return null;
}

/**
 * Activate a skill for a specific user session.
 * @param {string} userId
 * @param {string|null} skillId
 * @returns {Object|null}
 */
function setActiveSkill(userId, skillId) {
  if (!userId) return null;
  if (!skillId || skillId === 'off' || skillId === 'none') {
    activeUserSkills.delete(userId);
    return null;
  }
  const skill = getSkill(skillId);
  if (!skill) return null;
  activeUserSkills.set(userId, skill.id);
  return skill;
}

/**
 * Get the currently active skill for a user session.
 * @param {string} userId
 * @returns {Object|null}
 */
function getActiveSkill(userId) {
  if (!userId) return null;
  const id = activeUserSkills.get(userId);
  return id ? getSkill(id) : null;
}

module.exports = {
  loadSkills,
  listSkills,
  getSkill,
  setActiveSkill,
  getActiveSkill,
  parseSkillMarkdown,
};

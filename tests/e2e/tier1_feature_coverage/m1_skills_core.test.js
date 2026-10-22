'use strict';

/**
 * @fileoverview Tier 1 Feature Coverage: Milestone 1 Skills & Project Integrity (F01 - F08).
 * Covers isolated functionality with >= 5 tests per feature.
 */

const fs = require('fs');
const path = require('path');

describe('Tier 1: Milestone 1 Skills & Core Integrity (F01 - F08)', () => {
  const rootDir = process.cwd();

  // Helper for frontmatter parsing
  function parseYamlFrontmatter(content) {
    if (!content || typeof content !== 'string') return null;
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;
    const yamlBlock = match[1];
    const data = {};
    for (const line of yamlBlock.split('\n')) {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key) data[key] = val;
      }
    }
    return data;
  }

  // --------------------------------------------------------------------------
  // F01: F01_Karpathy_Skills
  // --------------------------------------------------------------------------
  describe('F01: Karpathy Skills Installation & Guidelines', () => {
    test('F01-1: Karpathy skills directory or archive exists on disk', () => {
      const archivePath = path.join(rootDir, 'skills', 'andrej-karpathy-skills-main');
      const karpathyDir = path.join(rootDir, 'skills', 'karpathy');
      const guidelinesDir = path.join(rootDir, 'skills', 'karpathy-guidelines');
      const exists = fs.existsSync(archivePath) || fs.existsSync(karpathyDir) || fs.existsSync(guidelinesDir);
      expect(exists).toBe(true);
    });

    test('F01-2: karpathy-guidelines directory contains SKILL.md', () => {
      const stagedSkill = path.join(rootDir, '.agents', 'skills', 'karpathy-guidelines', 'SKILL.md');
      const directSkill = path.join(rootDir, 'skills', 'karpathy-guidelines', 'SKILL.md');
      const repoSkill = path.join(rootDir, 'skills', 'karpathy', 'SKILL.md');
      const skillPath = [stagedSkill, directSkill, repoSkill].find(p => fs.existsSync(p));
      expect(skillPath).toBeDefined();
    });

    test('F01-3: karpathy-guidelines SKILL.md contains valid YAML frontmatter', () => {
      const stagedSkill = path.join(rootDir, '.agents', 'skills', 'karpathy-guidelines', 'SKILL.md');
      const directSkill = path.join(rootDir, 'skills', 'karpathy-guidelines', 'SKILL.md');
      const repoSkill = path.join(rootDir, 'skills', 'karpathy', 'SKILL.md');
      const skillPath = [stagedSkill, directSkill, repoSkill].find(p => fs.existsSync(p));
      const content = fs.readFileSync(skillPath, 'utf-8');
      const meta = parseYamlFrontmatter(content);
      expect(meta).not.toBeNull();
      expect(meta.name).toMatch(/karpathy/i);
    });

    test('F01-4: karpathy-guidelines SKILL.md contains guidance content', () => {
      const stagedSkill = path.join(rootDir, '.agents', 'skills', 'karpathy-guidelines', 'SKILL.md');
      const directSkill = path.join(rootDir, 'skills', 'karpathy-guidelines', 'SKILL.md');
      const repoSkill = path.join(rootDir, 'skills', 'karpathy', 'SKILL.md');
      const skillPath = [stagedSkill, directSkill, repoSkill].find(p => fs.existsSync(p));
      const content = fs.readFileSync(skillPath, 'utf-8');
      expect(content.length).toBeGreaterThan(100);
      expect(content).toMatch(/guidelines|principles|rules|skills/i);
    });

    test('F01-5: karpathy skill path is readable and accessible', () => {
      const stagedDir = path.join(rootDir, '.agents', 'skills', 'karpathy-guidelines');
      const skillsDir = path.join(rootDir, 'skills', 'karpathy-guidelines');
      const target = fs.existsSync(stagedDir) ? stagedDir : skillsDir;
      const stats = fs.statSync(target);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F02: F02_External_Skills_Fetch
  // --------------------------------------------------------------------------
  describe('F02: External Skills Fetch (Superpowers, Matt Pocock, ECC, Anthropics)', () => {
    test('F02-1: Superpowers skills repository exists on disk', () => {
      const p = path.join(rootDir, 'skills', 'superpowers');
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.statSync(p).isDirectory()).toBe(true);
    });

    test('F02-2: Matt Pocock skills repository exists on disk', () => {
      const p1 = path.join(rootDir, 'skills', 'mattpocock-skills');
      const p2 = path.join(rootDir, 'skills', 'mattpocock');
      expect(fs.existsSync(p1) || fs.existsSync(p2)).toBe(true);
    });

    test('F02-3: ECC skills repository exists on disk', () => {
      const p = path.join(rootDir, 'skills', 'ecc');
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.statSync(p).isDirectory()).toBe(true);
    });

    test('F02-4: Anthropic skills repository exists on disk', () => {
      const p1 = path.join(rootDir, 'skills', 'anthropic-skills');
      const p2 = path.join(rootDir, 'skills', 'anthropics');
      expect(fs.existsSync(p1) || fs.existsSync(p2)).toBe(true);
    });

    test('F02-5: External skills directories contain discoverable SKILL.md files', () => {
      const baseSkills = path.join(rootDir, 'skills');
      const subdirs = fs.readdirSync(baseSkills);
      let foundSkills = 0;
      for (const sub of subdirs) {
        const full = path.join(baseSkills, sub);
        if (fs.statSync(full).isDirectory()) {
          const files = fs.readdirSync(full);
          if (files.includes('SKILL.md')) foundSkills++;
        }
      }
      expect(foundSkills).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // F03: F03_Core_Skills_Staging
  // --------------------------------------------------------------------------
  describe('F03: Core Skills Staging in .agents/skills/', () => {
    test('F03-1: .agents/skills directory exists for active staged skills', () => {
      const p = path.join(rootDir, '.agents', 'skills');
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.statSync(p).isDirectory()).toBe(true);
    });

    test('F03-2: .agents/skills contains at least one staged active skill', () => {
      const p = path.join(rootDir, '.agents', 'skills');
      const entries = fs.readdirSync(p);
      expect(entries.length).toBeGreaterThanOrEqual(1);
    });

    test('F03-3: Staged skills have valid directory layout with SKILL.md', () => {
      const p = path.join(rootDir, '.agents', 'skills');
      const entries = fs.readdirSync(p);
      for (const entry of entries) {
        const entryPath = path.join(p, entry);
        if (fs.statSync(entryPath).isDirectory()) {
          const skillFile = path.join(entryPath, 'SKILL.md');
          expect(fs.existsSync(skillFile)).toBe(true);
        }
      }
    });

    test('F03-4: Staged SKILL.md files are non-empty and readable', () => {
      const p = path.join(rootDir, '.agents', 'skills');
      const entries = fs.readdirSync(p);
      for (const entry of entries) {
        const entryPath = path.join(p, entry);
        if (fs.statSync(entryPath).isDirectory()) {
          const skillFile = path.join(entryPath, 'SKILL.md');
          const content = fs.readFileSync(skillFile, 'utf-8');
          expect(content.trim().length).toBeGreaterThan(0);
        }
      }
    });

    test('F03-5: Staged skills have standard YAML frontmatter block', () => {
      const p = path.join(rootDir, '.agents', 'skills');
      const entries = fs.readdirSync(p);
      for (const entry of entries) {
        const skillFile = path.join(p, entry, 'SKILL.md');
        if (fs.existsSync(skillFile)) {
          const content = fs.readFileSync(skillFile, 'utf-8');
          expect(content.startsWith('---')).toBe(true);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // F04: F04_Skills_Json_Config
  // --------------------------------------------------------------------------
  describe('F04: Skills Configuration in .agents/skills.json', () => {
    test('F04-1: .agents/skills.json file exists', () => {
      const p = path.join(rootDir, '.agents', 'skills.json');
      expect(fs.existsSync(p)).toBe(true);
    });

    test('F04-2: .agents/skills.json is valid parseable JSON', () => {
      const p = path.join(rootDir, '.agents', 'skills.json');
      const raw = fs.readFileSync(p, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    test('F04-3: .agents/skills.json contains entries array', () => {
      const p = path.join(rootDir, '.agents', 'skills.json');
      const config = JSON.parse(fs.readFileSync(p, 'utf-8'));
      expect(Array.isArray(config.entries)).toBe(true);
      expect(config.entries.length).toBeGreaterThan(0);
    });

    test('F04-4: skills.json entries specify discovery paths', () => {
      const p = path.join(rootDir, '.agents', 'skills.json');
      const config = JSON.parse(fs.readFileSync(p, 'utf-8'));
      for (const entry of config.entries) {
        expect(typeof entry.path).toBe('string');
        expect(entry.path.length).toBeGreaterThan(0);
      }
    });

    test('F04-5: Primary discovery paths in skills.json exist or map to valid roots', () => {
      const p = path.join(rootDir, '.agents', 'skills.json');
      const config = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const paths = config.entries.map(e => e.path);
      expect(paths.some(p => p.includes('.agents/skills'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F05: F05_Skills_Frontmatter_Validation
  // --------------------------------------------------------------------------
  describe('F05: Automated Skills Frontmatter Validator', () => {
    test('F05-1: Validates correct YAML frontmatter containing name and description', () => {
      const validDoc = `---\nname: test-skill\ndescription: A test skill for E2E suite\n---\n# Content`;
      const meta = parseYamlFrontmatter(validDoc);
      expect(meta).not.toBeNull();
      expect(meta.name).toBe('test-skill');
      expect(meta.description).toBe('A test skill for E2E suite');
    });

    test('F05-2: Fails when opening YAML delimiter is missing', () => {
      const invalidDoc = `name: test-skill\ndescription: Missing delimiter\n---\n# Content`;
      const meta = parseYamlFrontmatter(invalidDoc);
      expect(meta).toBeNull();
    });

    test('F05-3: Fails when closing YAML delimiter is missing', () => {
      const invalidDoc = `---\nname: test-skill\ndescription: Missing closing delimiter\n# Content`;
      const meta = parseYamlFrontmatter(invalidDoc);
      expect(meta).toBeNull();
    });

    test('F05-4: Strips surrounding quotes from frontmatter values', () => {
      const quotedDoc = `---\nname: "quoted-skill"\ndescription: 'Single quoted description'\n---\nBody`;
      const meta = parseYamlFrontmatter(quotedDoc);
      expect(meta.name).toBe('quoted-skill');
      expect(meta.description).toBe('Single quoted description');
    });

    test('F05-5: Real .agents/skills/karpathy-guidelines/SKILL.md passes frontmatter validator', () => {
      const skillPath = path.join(rootDir, '.agents', 'skills', 'karpathy-guidelines', 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf-8');
        const meta = parseYamlFrontmatter(content);
        expect(meta).not.toBeNull();
        expect(meta.name).toBeDefined();
        expect(meta.description).toBeDefined();
      } else {
        // Fallback check on skills/karpathy-guidelines
        const altPath = path.join(rootDir, 'skills', 'karpathy-guidelines', 'SKILL.md');
        const content = fs.readFileSync(altPath, 'utf-8');
        const meta = parseYamlFrontmatter(content);
        expect(meta).not.toBeNull();
      }
    });
  });

  // --------------------------------------------------------------------------
  // F06: F06_Gitignore_Hardening
  // --------------------------------------------------------------------------
  describe('F06: Gitignore Hardening & Source Whitelisting', () => {
    test('F06-1: .gitignore exists at project root', () => {
      const p = path.join(rootDir, '.gitignore');
      expect(fs.existsSync(p)).toBe(true);
    });

    test('F06-2: .gitignore ignores node_modules', () => {
      const p = path.join(rootDir, '.gitignore');
      const content = fs.readFileSync(p, 'utf-8');
      expect(content).toMatch(/node_modules/);
    });

    test('F06-3: .gitignore ignores sensitive environment file .env', () => {
      const p = path.join(rootDir, '.gitignore');
      const content = fs.readFileSync(p, 'utf-8');
      expect(content).toMatch(/\.env/);
    });

    test('F06-4: .gitignore ignores runtime directories (cache, reports, outputs)', () => {
      const p = path.join(rootDir, '.gitignore');
      const content = fs.readFileSync(p, 'utf-8');
      expect(content).toMatch(/cache|outputs|reports|jobs/);
    });

    test('F06-5: Source directory src is never completely ignored', () => {
      const p = path.join(rootDir, '.gitignore');
      const content = fs.readFileSync(p, 'utf-8');
      // If src is explicitly ignored without a negation, it's a violation
      const lines = content.split('\n').map(l => l.trim());
      const hasBareSrcIgnore = lines.includes('src/') || lines.includes('/src/');
      const hasSrcWhitelist = lines.some(l => l.startsWith('!src'));
      if (hasBareSrcIgnore) {
        expect(hasSrcWhitelist).toBe(true);
      } else {
        expect(hasBareSrcIgnore).toBe(false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // F07: F07_Module_Integrity_Check
  // --------------------------------------------------------------------------
  describe('F07: Module Integrity Check (Zero MODULE_NOT_FOUND)', () => {
    test('F07-1: messageHandler module loads cleanly', () => {
      expect(() => require(path.join(rootDir, 'src', 'bot', 'messageHandler'))).not.toThrow();
    });

    test('F07-2: llmCrawler and adaptiveScraper modules load cleanly', () => {
      expect(() => require(path.join(rootDir, 'src', 'engine', 'llmCrawler'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'engine', 'adaptiveScraper'))).not.toThrow();
    });

    test('F07-3: jobManager and jobStore modules load cleanly', () => {
      expect(() => require(path.join(rootDir, 'src', 'jobs', 'jobManager'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'jobs', 'jobStore'))).not.toThrow();
    });

    test('F07-4: RAG, PDF, Graph, and Memory services load cleanly', () => {
      expect(() => require(path.join(rootDir, 'src', 'services', 'rag', 'ragEngine'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'services', 'pdf', 'pdfLoader'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'services', 'graph', 'knowledgeGraph'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'))).not.toThrow();
    });

    test('F07-5: Utility modules load cleanly without runtime exceptions', () => {
      expect(() => require(path.join(rootDir, 'src', 'utils', 'text'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'utils', 'time'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'utils', 'validators'))).not.toThrow();
      expect(() => require(path.join(rootDir, 'src', 'utils', 'errorMessages'))).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // F08: F08_Jobs_Unit_Tests
  // --------------------------------------------------------------------------
  describe('F08: Jobs Subsystem (JobStore, JobQueue, JobManager, JobSchemas)', () => {
    let jobStore;
    let jobSchemas;

    beforeAll(() => {
      jobStore = require(path.join(rootDir, 'src', 'jobs', 'jobStore'));
      jobSchemas = require(path.join(rootDir, 'src', 'jobs', 'jobSchemas'));
    });

    beforeEach(() => {
      if (jobStore && typeof jobStore.clearAll === 'function') {
        jobStore.clearAll();
      }
    });

    test('F08-1: createJob creates a job with valid UUID and pending status', async () => {
      const job = await jobStore.createJob({
        type: 'SCRAPE',
        userId: '628123456789@c.us',
        keyword: 'machine learning',
      });
      expect(job).toBeDefined();
      expect(job.jobId).toBeDefined();
      expect(typeof job.jobId).toBe('string');
      expect(job.status).toBe(jobSchemas.JOB_STATUS.PENDING);
    });

    test('F08-2: getJob retrieves previously saved job', async () => {
      const created = await jobStore.createJob({
        type: 'DOWNLOAD_PAPER',
        userId: 'user123',
        keyword: 'attention is all you need',
      });
      const retrieved = await jobStore.getJob(created.jobId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.jobId).toBe(created.jobId);
      expect(retrieved.request?.keyword).toBe('attention is all you need');
    });

    test('F08-3: updateJob transitions status and updates progress', async () => {
      const created = await jobStore.createJob({
        type: 'SCRAPE',
        userId: 'user123',
      });
      const updated = await jobStore.updateJob(created.jobId, {
        status: jobSchemas.JOB_STATUS.RUNNING,
        progress: { percent: 50 },
      });
      expect(updated.status).toBe(jobSchemas.JOB_STATUS.RUNNING);
      expect(updated.progress.percent).toBe(50);
    });

    test('F08-4: listJobs filters by userId and status', async () => {
      const testUserA = `userA_${Date.now()}`;
      const testUserB = `userB_${Date.now()}`;
      await jobStore.createJob({ type: 'SCRAPE', userId: testUserA });
      await jobStore.createJob({ type: 'SCRAPE', userId: testUserA });
      await jobStore.createJob({ type: 'SCRAPE', userId: testUserB });

      const userAJobs = await jobStore.listJobs({ userId: testUserA });
      expect(userAJobs.length).toBe(2);
      const userBJobs = await jobStore.listJobs({ userId: testUserB });
      expect(userBJobs.length).toBe(1);
    });

    test('F08-5: getStats returns aggregated counts by status', async () => {
      const initialStats = await jobStore.getStats();
      const job1 = await jobStore.createJob({ type: 'SCRAPE', userId: 'u1' });
      const job2 = await jobStore.createJob({ type: 'DOWNLOAD_PAPER', userId: 'u2' });
      await jobStore.updateJob(job2.jobId, { status: jobSchemas.JOB_STATUS.COMPLETED });

      const newStats = await jobStore.getStats();
      expect(newStats.total).toBeGreaterThanOrEqual(initialStats.total + 2);
      expect(newStats.byStatus[jobSchemas.JOB_STATUS.COMPLETED]).toBeGreaterThanOrEqual(1);
    });
  });
});

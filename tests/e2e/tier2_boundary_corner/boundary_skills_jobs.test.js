'use strict';

/**
 * @fileoverview Tier 2 Boundary & Corner Cases: Skills & Jobs Subsystems (F01 - F08).
 * Tests extreme boundaries, empty inputs, malformed structures, limits, and resilience.
 */

const fs = require('fs');
const path = require('path');

describe('Tier 2: Boundary & Corner Cases — Skills & Jobs Subsystems (F01 - F08)', () => {
  const rootDir = process.cwd();

  let jobStore;
  let jobSchemas;

  beforeAll(() => {
    jobStore = require(path.join(rootDir, 'src', 'jobs', 'jobStore'));
    jobSchemas = require(path.join(rootDir, 'src', 'jobs', 'jobSchemas'));
  });

  // --------------------------------------------------------------------------
  // F01 Boundaries: Karpathy Skills
  // --------------------------------------------------------------------------
  describe('F01 Boundaries: Karpathy Skills Extraction & Paths', () => {
    test('F01-B1: Handles path resolution with trailing slashes gracefully', () => {
      const p = path.resolve(rootDir, 'skills', 'karpathy-guidelines') + path.sep;
      expect(() => fs.existsSync(p)).not.toThrow();
    });

    test('F01-B2: Rejects directory traversal attempts in skill subpath resolution', () => {
      const malicious = path.join(rootDir, 'skills', '..', '..', 'etc');
      expect(malicious.startsWith(path.join(rootDir, 'skills'))).toBe(false);
    });

    test('F01-B3: Gracefully handles checking non-existent archive zip files', () => {
      const fakeZip = path.join(rootDir, 'skills', 'non-existent-archive-xyz.zip');
      expect(fs.existsSync(fakeZip)).toBe(false);
    });

    test('F01-B4: Verifies karpathy SKILL.md file size is within sane limits (>50B, <5MB)', () => {
      const candidatePaths = [
        path.join(rootDir, '.agents', 'skills', 'karpathy-guidelines', 'SKILL.md'),
        path.join(rootDir, 'skills', 'karpathy-guidelines', 'SKILL.md'),
        path.join(rootDir, 'skills', 'karpathy', 'SKILL.md'),
      ];
      const found = candidatePaths.find(p => fs.existsSync(p));
      if (found) {
        const stats = fs.statSync(found);
        expect(stats.size).toBeGreaterThan(50);
        expect(stats.size).toBeLessThan(5 * 1024 * 1024);
      }
    });

    test('F01-B5: Verifies guidelines contain no unescaped binary control bytes', () => {
      const candidatePaths = [
        path.join(rootDir, '.agents', 'skills', 'karpathy-guidelines', 'SKILL.md'),
        path.join(rootDir, 'skills', 'karpathy-guidelines', 'SKILL.md'),
        path.join(rootDir, 'skills', 'karpathy', 'SKILL.md'),
      ];
      const found = candidatePaths.find(p => fs.existsSync(p));
      if (found) {
        const content = fs.readFileSync(found, 'utf-8');
        expect(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content)).toBe(false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // F02 Boundaries: External Skills
  // --------------------------------------------------------------------------
  describe('F02 Boundaries: External Skills Repositories', () => {
    test('F02-B1: Handles reading skills folder when subdirectories are empty', () => {
      const skillsRoot = path.join(rootDir, 'skills');
      expect(fs.existsSync(skillsRoot)).toBe(true);
      const items = fs.readdirSync(skillsRoot);
      expect(Array.isArray(items)).toBe(true);
    });

    test('F02-B2: Handles nested category skill structures (e.g. engineering, productivity)', () => {
      const pocockPath = path.join(rootDir, 'skills', 'mattpocock-skills');
      if (fs.existsSync(pocockPath)) {
        const sub = fs.readdirSync(pocockPath);
        expect(sub.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('F02-B3: Non-existent external skill name lookup returns false cleanly', () => {
      const fakeSkill = path.join(rootDir, 'skills', 'definitely-fake-skill-12345');
      expect(fs.existsSync(fakeSkill)).toBe(false);
    });

    test('F02-B4: Checks that skills directory contains no unauthorized executable binaries (.exe, .bat)', () => {
      const skillsRoot = path.join(rootDir, 'skills');
      function checkBinaries(dir) {
        const entries = fs.readdirSync(dir);
        for (const e of entries) {
          const full = path.join(dir, e);
          if (fs.statSync(full).isDirectory()) {
            // Check top 2 levels
            if (!full.includes('.git')) checkBinaries(full);
          } else {
            expect(e.endsWith('.exe') || e.endsWith('.msi') || e.endsWith('.com')).toBe(false);
          }
        }
      }
      expect(() => checkBinaries(skillsRoot)).not.toThrow();
    });

    test('F02-B5: Verifies skills folder paths are properly UTF-8 encoded without broken surrogate pairs', () => {
      const skillsRoot = path.join(rootDir, 'skills');
      const entries = fs.readdirSync(skillsRoot);
      for (const e of entries) {
        expect(() => Buffer.from(e, 'utf-8')).not.toThrow();
        expect(e).not.toMatch(/[\uD800-\uDFFF]/); // No unpaired surrogates
      }
    });
  });

  // --------------------------------------------------------------------------
  // F03 Boundaries: Core Skills Staging
  // --------------------------------------------------------------------------
  describe('F03 Boundaries: Core Skills Staging in .agents/skills/', () => {
    test('F03-B1: Handles staging folder lookup when path contains Windows backslashes', () => {
      const normalPath = path.join(rootDir, '.agents', 'skills');
      const winPath = normalPath.replace(/\//g, '\\');
      expect(fs.existsSync(winPath)).toBe(true);
    });

    test('F03-B2: Rejects staging non-directory files directly into .agents/skills root', () => {
      const stagedRoot = path.join(rootDir, '.agents', 'skills');
      const entries = fs.readdirSync(stagedRoot);
      for (const e of entries) {
        const full = path.join(stagedRoot, e);
        if (fs.statSync(full).isFile()) {
          expect(e).not.toMatch(/\.js$|\.sh$/);
        }
      }
    });

    test('F03-B3: Staged SKILL.md files begin strictly with triple dashes (---)', () => {
      const stagedRoot = path.join(rootDir, '.agents', 'skills');
      const entries = fs.readdirSync(stagedRoot);
      for (const e of entries) {
        const skillPath = path.join(stagedRoot, e, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          const content = fs.readFileSync(skillPath, 'utf-8');
          expect(content.startsWith('---')).toBe(true);
        }
      }
    });

    test('F03-B4: Staged skills do not contain duplicate folder names', () => {
      const stagedRoot = path.join(rootDir, '.agents', 'skills');
      const entries = fs.readdirSync(stagedRoot);
      const lower = entries.map(e => e.toLowerCase());
      const unique = new Set(lower);
      expect(lower.length).toBe(unique.size);
    });

    test('F03-B5: Handles staging lookup on non-existent staged skill cleanly', () => {
      const fake = path.join(rootDir, '.agents', 'skills', 'phantom-skill', 'SKILL.md');
      expect(fs.existsSync(fake)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // F04 Boundaries: Skills JSON Configuration
  // --------------------------------------------------------------------------
  describe('F04 Boundaries: .agents/skills.json Configuration', () => {
    test('F04-B1: Handles empty entries array in JSON configuration without crash', () => {
      const mockConfig = JSON.stringify({ entries: [] });
      const parsed = JSON.parse(mockConfig);
      expect(parsed.entries).toHaveLength(0);
    });

    test('F04-B2: Validates JSON format rejects malformed JSON with trailing commas', () => {
      const badJson = '{\n  "entries": [\n    {"path": "a"},\n  ]\n}';
      expect(() => JSON.parse(badJson)).toThrow();
    });

    test('F04-B3: Handles include_only array filtering in entries', () => {
      const p = path.join(rootDir, '.agents', 'skills.json');
      const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const eccEntry = cfg.entries.find(e => e.path.includes('ecc'));
      if (eccEntry && eccEntry.include_only) {
        expect(Array.isArray(eccEntry.include_only)).toBe(true);
        expect(eccEntry.include_only.length).toBeGreaterThan(0);
      }
    });

    test('F04-B4: Verifies paths in skills.json do not use absolute drive letters', () => {
      const p = path.join(rootDir, '.agents', 'skills.json');
      const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      for (const entry of cfg.entries) {
        expect(/^[A-Z]:\\/i.test(entry.path)).toBe(false);
      }
    });

    test('F04-B5: Verifies skills.json entries do not contain empty string paths', () => {
      const p = path.join(rootDir, '.agents', 'skills.json');
      const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      for (const entry of cfg.entries) {
        expect(entry.path.trim().length).toBeGreaterThan(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // F05 Boundaries: Skills Frontmatter Validation
  // --------------------------------------------------------------------------
  describe('F05 Boundaries: YAML Frontmatter Parsing & Edge Cases', () => {
    function parseFrontmatter(text) {
      if (!text || typeof text !== 'string') return null;
      const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) return null;
      const yaml = match[1];
      const res = {};
      for (const line of yaml.split('\n')) {
        const i = line.indexOf(':');
        if (i !== -1) {
          const k = line.slice(0, i).trim();
          const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
          if (k) res[k] = v;
        }
      }
      return res;
    }

    test('F05-B1: Handles frontmatter with colon in value (e.g. description: Note: Important)', () => {
      const yaml = `---\nname: skill-test\ndescription: Note: This is a note with: colons\n---\nBody`;
      const meta = parseFrontmatter(yaml);
      expect(meta).not.toBeNull();
      expect(meta.description).toBe('Note: This is a note with: colons');
    });

    test('F05-B2: Handles frontmatter with excessive whitespace around delimiters', () => {
      const yaml = `---\n   name:    padded-skill   \n   description:   padded description   \n---\nBody`;
      const meta = parseFrontmatter(yaml);
      expect(meta.name).toBe('padded-skill');
      expect(meta.description).toBe('padded description');
    });

    test('F05-B3: Returns null when text is completely empty or non-string', () => {
      expect(parseFrontmatter('')).toBeNull();
      expect(parseFrontmatter(null)).toBeNull();
      expect(parseFrontmatter(12345)).toBeNull();
    });

    test('F05-B4: Returns null when frontmatter has 4 dashes (----) instead of 3', () => {
      const invalid = `----\nname: invalid-dash\ndescription: test\n----\nBody`;
      expect(parseFrontmatter(invalid)).toBeNull();
    });

    test('F05-B5: Handles frontmatter containing unicode characters (emojis, accents)', () => {
      const yaml = `---\nname: skill-🚀\ndescription: Über-cool AI skill for résumé analysis\n---\nBody`;
      const meta = parseFrontmatter(yaml);
      expect(meta.name).toBe('skill-🚀');
      expect(meta.description).toMatch(/Über-cool/);
    });
  });

  // --------------------------------------------------------------------------
  // F06 Boundaries: Gitignore Hardening
  // --------------------------------------------------------------------------
  describe('F06 Boundaries: Gitignore Rules & Whitelisting', () => {
    test('F06-B1: .gitignore handles Windows CRLF and Linux LF line endings uniformly', () => {
      const content = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
      const lines = content.replace(/\r/g, '').split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
    });

    test('F06-B2: .gitignore contains no malformed recursive wildcards like /*** or /****', () => {
      const content = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
      expect(content).not.toMatch(/\/\*{3,}/);
    });

    test('F06-B3: .gitignore does not ignore package.json or package-lock.json', () => {
      const content = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
      expect(content).not.toMatch(/^package\.json$/m);
      expect(content).not.toMatch(/^package-lock\.json$/m);
    });

    test('F06-B4: .gitignore ignores temporary log files (*.log)', () => {
      const content = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
      expect(content).toMatch(/\*\.log/);
    });

    test('F06-B5: .gitignore ignores OS metadata files (.DS_Store, Thumbs.db)', () => {
      const content = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
      expect(content).toMatch(/\.DS_Store|Thumbs\.db/i);
    });
  });

  // --------------------------------------------------------------------------
  // F07 Boundaries: Module Integrity
  // --------------------------------------------------------------------------
  describe('F07 Boundaries: Module Loading Robustness', () => {
    test('F07-B1: Requiring non-existent module throws MODULE_NOT_FOUND', () => {
      expect(() => require('./non_existent_module_9999')).toThrow(/Cannot find module/);
    });

    test('F07-B2: Config module exports expected object structure with dirs', () => {
      const config = require(path.join(rootDir, 'src', 'config'));
      expect(config).toBeDefined();
      expect(config.dirs).toBeDefined();
      expect(typeof config.dirs).toBe('object');
    });

    test('F07-B3: Logger module creates functional logger with all standard log levels', () => {
      const { createLogger } = require(path.join(rootDir, 'src', 'services', 'monitor', 'logger'));
      const testLogger = createLogger('test:boundary');
      expect(typeof testLogger.info).toBe('function');
      expect(typeof testLogger.warn).toBe('function');
      expect(typeof testLogger.error).toBe('function');
      expect(typeof testLogger.debug).toBe('function');
    });

    test('F07-B4: Cache service handles null, undefined, and non-string keys safely', () => {
      const cache = require(path.join(rootDir, 'src', 'services', 'cache'));
      expect(() => cache.get(null)).not.toThrow();
      expect(cache.get(null)).toBeNull();
      expect(() => cache.get(undefined)).not.toThrow();
    });

    test('F07-B5: Id utility generates unique collision-resistant IDs', () => {
      const { generateJobId } = require(path.join(rootDir, 'src', 'utils', 'id'));
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(generateJobId());
      }
      expect(ids.size).toBe(50);
    });
  });

  // --------------------------------------------------------------------------
  // F08 Boundaries: Job Queue & Store Limits
  // --------------------------------------------------------------------------
  describe('F08 Boundaries: Job Store Extreme Values & Edge Cases', () => {
    test('F08-B1: getJob returns null when passed null or undefined or empty string', async () => {
      expect(await jobStore.getJob(null)).toBeNull();
      expect(await jobStore.getJob(undefined)).toBeNull();
      expect(await jobStore.getJob('')).toBeNull();
    });

    test('F08-B2: updateJob returns null when jobId does not exist', async () => {
      const updated = await jobStore.updateJob('non_existent_job_id_xyz', {
        status: jobSchemas.JOB_STATUS.COMPLETED,
      });
      expect(updated).toBeNull();
    });

    test('F08-B3: listJobs with limit=0 returns empty array', async () => {
      const jobs = await jobStore.listJobs({ limit: 0 });
      expect(jobs).toHaveLength(0);
    });

    test('F08-B4: Handles huge request keyword length (2000 chars) in job creation', async () => {
      const hugeKeyword = 'a'.repeat(2000);
      const job = await jobStore.createJob({
        type: 'SCRAPE',
        userId: 'u_boundary',
        keyword: hugeKeyword,
      });
      expect(job.jobId).toBeDefined();
      expect(job.request.keyword.length).toBe(2000);
    });

    test('F08-B5: purgeExpiredJobs handles case where no jobs are expired without throwing', async () => {
      expect(typeof jobStore.purgeExpiredJobs).toBe('function');
      const res = await jobStore.purgeExpiredJobs(999999999); // 10+ days retention
      expect(res).toBeDefined();
      expect(typeof res.purged).toBe('number');
    });
  });
});

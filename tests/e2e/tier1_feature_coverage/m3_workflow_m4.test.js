'use strict';

/**
 * @fileoverview Tier 1 Feature Coverage: Milestone 3 Workflow & Milestone 4 Verification (F28 - F31).
 * Covers isolated functionality with >= 5 tests per feature.
 */

const fs = require('fs');
const path = require('path');
const { createMockMsg, createMockClient } = require('../../fixtures/mockHelpers');

describe('Tier 1: Milestone 3 Workflow & Milestone 4 Verification (F28 - F31)', () => {
  const rootDir = process.cwd();

  let jobStore;
  let jobSchemas;
  let textUtils;

  beforeAll(() => {
    jobStore = require(path.join(rootDir, 'src', 'jobs', 'jobStore'));
    jobSchemas = require(path.join(rootDir, 'src', 'jobs', 'jobSchemas'));
    textUtils = require(path.join(rootDir, 'src', 'utils', 'text'));
  });

  // --------------------------------------------------------------------------
  // F28: F28_Research_Workflow_Engine
  // --------------------------------------------------------------------------
  describe('F28: Research Workflow Engine & Agentic DAG Specification', () => {
    test('F28-1: WORKFLOW job type is recognized and defined in JOB_TYPES schema', () => {
      expect(jobSchemas.JOB_TYPES.WORKFLOW).toBe('WORKFLOW');
    });

    test('F28-2: Initializes workflow job with PENDING status and empty results', async () => {
      const job = await jobStore.createJob({
        type: jobSchemas.JOB_TYPES.WORKFLOW,
        userId: 'researcher_01',
        keyword: 'Quantum Error Correction',
      });

      expect(job.type).toBe('WORKFLOW');
      expect(job.status).toBe(jobSchemas.JOB_STATUS.PENDING);
      expect(job.result.items).toHaveLength(0);
    });

    test('F28-3: Tracks DAG execution step progress via jobStore updateJob', async () => {
      const job = await jobStore.createJob({
        type: jobSchemas.JOB_TYPES.WORKFLOW,
        userId: 'researcher_01',
      });

      // Transition step 1: Crawl
      const s1 = await jobStore.updateJob(job.jobId, {
        status: jobSchemas.JOB_STATUS.RUNNING,
        progress: { percent: 25, message: 'Step 1/4: Crawling web resources' },
      });
      expect(s1.status).toBe(jobSchemas.JOB_STATUS.RUNNING);
      expect(s1.progress.percent).toBe(25);

      // Transition step 4: Synthesis Complete
      const s4 = await jobStore.updateJob(job.jobId, {
        status: jobSchemas.JOB_STATUS.COMPLETED,
        progress: { percent: 100, message: 'Step 4/4: Research report generated' },
        result: {
          itemCount: 1,
          files: ['report.md'],
        },
      });
      expect(s4.status).toBe(jobSchemas.JOB_STATUS.COMPLETED);
      expect(s4.result.files).toContain('report.md');
    });

    test('F28-4: Handles step failure with FAILED status and error recording', async () => {
      const job = await jobStore.createJob({
        type: jobSchemas.JOB_TYPES.WORKFLOW,
        userId: 'researcher_01',
      });

      const failedJob = await jobStore.updateJob(job.jobId, {
        status: jobSchemas.JOB_STATUS.FAILED,
        error: 'Crawl bridge timeout on step 2',
      });

      expect(failedJob.status).toBe(jobSchemas.JOB_STATUS.FAILED);
      expect(failedJob.error).toMatch(/timeout/i);
    });

    test('F28-5: Supports CANCELLED transition when user cancels active workflow', async () => {
      const job = await jobStore.createJob({
        type: jobSchemas.JOB_TYPES.WORKFLOW,
        userId: 'researcher_01',
      });

      const cancelled = await jobStore.updateJob(job.jobId, {
        status: jobSchemas.JOB_STATUS.CANCELLED,
      });

      expect(cancelled.status).toBe(jobSchemas.JOB_STATUS.CANCELLED);
    });
  });

  // --------------------------------------------------------------------------
  // F29: F29_Doc_Graph_Memory_Commands
  // --------------------------------------------------------------------------
  describe('F29: Bot Document, Graph, and Memory Commands', () => {
    test('F29-1: Command parser splits command names and arguments cleanly', () => {
      const res = textUtils.splitArgs('!docqa "what is the error rate?" --top 3');
      expect(res.command).toBe('docqa');
      expect(res.args.length).toBeGreaterThanOrEqual(1);
    });

    test('F29-2: Command parser parses !graph command with entity arguments', () => {
      const res = textUtils.splitArgs('!graph "AlphaFold"');
      expect(res.command).toBe('graph');
      expect(res.raw).toBe('"AlphaFold"');
    });

    test('F29-3: Command parser parses !memory with show and clear subcommands', () => {
      const resShow = textUtils.splitArgs('!memory show');
      expect(resShow.command).toBe('memory');
      expect(resShow.args[0]).toBe('show');

      const resClear = textUtils.splitArgs('!memory clear');
      expect(resClear.command).toBe('memory');
      expect(resClear.args[0]).toBe('clear');
    });

    test('F29-4: Help command lists available system commands', async () => {
      const helpHandler = require(path.join(rootDir, 'src', 'commands', 'handlers', 'help.handler'));
      const mockMsg = createMockMsg('!help');
      await helpHandler.handle(mockMsg, [], {});
      expect(mockMsg.replies.length).toBeGreaterThan(0);
      expect(mockMsg.replies[0].content).toMatch(/bantuan|menu|commands/i);
    });

    test('F29-5: Status command handler reports job state to user', async () => {
      const statusHandler = require(path.join(rootDir, 'src', 'commands', 'handlers', 'status.handler'));
      const job = await jobStore.createJob({ type: 'SCRAPE', userId: 'status_user' });

      const mockMsg = createMockMsg(`!status ${job.jobId}`);
      await statusHandler.handle(mockMsg, [job.jobId], {});
      expect(mockMsg.replies.length).toBeGreaterThan(0);
      expect(mockMsg.replies[0].content).toMatch(new RegExp(job.jobId));
    });
  });

  // --------------------------------------------------------------------------
  // F30: F30_E2E_Test_Suite_Pass
  // --------------------------------------------------------------------------
  describe('F30: Automated E2E Test Suite Integrity', () => {
    test('F30-1: package.json scripts defines test with Jest', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts.test).toMatch(/jest/);
    });

    test('F30-2: Jest roots includes <rootDir>/tests', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      expect(pkg.jest.roots).toContain('<rootDir>/tests');
    });

    test('F30-3: testPathIgnorePatterns ignores node_modules and skills archives', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      expect(pkg.jest.testPathIgnorePatterns).toContain('/node_modules/');
      expect(pkg.jest.testPathIgnorePatterns).toContain('/skills/');
    });

    test('F30-4: PROJECT.md inventories all 31 project features', () => {
      const projectMd = fs.readFileSync(path.join(rootDir, 'PROJECT.md'), 'utf-8');
      for (let i = 1; i <= 31; i++) {
        const featTag = `F${String(i).padStart(2, '0')}`;
        expect(projectMd).toMatch(new RegExp(`\\|\\s*${i}\\s*\\|\\s*${featTag}_`));
      }
    });

    test('F30-5: Test fixtures exist and export required test datasets', () => {
      const samplePages = require('../../fixtures/samplePages');
      const sampleDocs = require('../../fixtures/sampleDocs');
      expect(samplePages.blogPage).toBeDefined();
      expect(sampleDocs.academicPaperText).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // F31: F31_Adversarial_Coverage_Hardening
  // --------------------------------------------------------------------------
  describe('F31: White-Box Adversarial Testing & Boundary Hardening', () => {
    const llmCrawler = require(path.join(rootDir, 'src', 'engine', 'llmCrawler'));
    const contextCompressor = require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'));
    const pdfLoader = require(path.join(rootDir, 'src', 'services', 'pdf', 'pdfLoader'));

    test('F31-1: Handles completely empty HTML string without throwing', () => {
      expect(() => llmCrawler.htmlToMarkdown('')).not.toThrow();
      const res = llmCrawler.htmlToMarkdown('');
      expect(res.markdown).toBe('');
      expect(res.wordCount).toBe(0);
    });

    test('F31-2: Handles deeply nested HTML (150 nested divs) without recursion overflow', () => {
      let deepHtml = '<p>Deep text</p>';
      for (let i = 0; i < 150; i++) {
        deepHtml = `<div>${deepHtml}</div>`;
      }
      expect(() => llmCrawler.htmlToMarkdown(deepHtml)).not.toThrow();
      const res = llmCrawler.htmlToMarkdown(deepHtml);
      expect(res.markdown).toMatch(/Deep text/);
    });

    test('F31-3: Handles extreme text size (150KB) in contextCompressor without crash', () => {
      const hugeText = 'Artificial Intelligence and Machine Learning.\n'.repeat(3000); // ~150KB
      expect(() => contextCompressor.compressText(hugeText, { targetRatio: 0.1 })).not.toThrow();
      const res = contextCompressor.compressText(hugeText, { targetRatio: 0.1 });
      expect(res.stats.compressedTokens).toBeLessThan(res.stats.originalTokens);
    });

    test('F31-4: Handles invalid non-string input to pdfLoader.extractLayoutStructure safely', () => {
      expect(() => pdfLoader.extractLayoutStructure(null)).not.toThrow();
      expect(() => pdfLoader.extractLayoutStructure(undefined)).not.toThrow();
      expect(() => pdfLoader.extractLayoutStructure(12345)).not.toThrow();
    });

    test('F31-5: Handles special regex meta-characters in search queries without regex injection', () => {
      const ragEngine = require(path.join(rootDir, 'src', 'services', 'rag', 'ragEngine'));
      expect(() => ragEngine.tokenizeWords('***[([{\\^$|?*+])}]***')).not.toThrow();
      const tokens = ragEngine.tokenizeWords('***[([{\\^$|?*+])}]***');
      expect(Array.isArray(tokens)).toBe(true);
    });
  });
});

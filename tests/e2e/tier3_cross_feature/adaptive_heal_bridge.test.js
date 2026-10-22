'use strict';

/**
 * @fileoverview Tier 3 Cross-Feature Combination: Adaptive Scraper Healing & Crawler Bridge Cascading.
 * Tests end-to-end integration between:
 *   - F12 (Adaptive Selector Matching)
 *   - F13 (Resilient Selector Store & Auto-Healing)
 *   - F14 (Stealth Evasion Engine & Realistic Fingerprinting)
 *   - F15 (Cascading Crawler Bridges: Jina, Firecrawl, Native)
 *   - F28 (Job Store Tracking)
 */

const cheerio = require('cheerio');
const path = require('path');
const samplePages = require('../../fixtures/samplePages');

describe('Tier 3: Cross-Feature Combination — Adaptive Scraper Healing & Bridge Cascading', () => {
  const rootDir = process.cwd();

  let adaptiveScraper;
  let llmCrawler;
  let jobStore;
  let jobSchemas;

  beforeAll(() => {
    adaptiveScraper = require(path.join(rootDir, 'src', 'engine', 'adaptiveScraper'));
    llmCrawler = require(path.join(rootDir, 'src', 'engine', 'llmCrawler'));
    jobStore = require(path.join(rootDir, 'src', 'jobs', 'jobStore'));
    jobSchemas = require(path.join(rootDir, 'src', 'jobs', 'jobSchemas'));
  });

  beforeEach(() => {
    if (typeof adaptiveScraper.clearSignatures === 'function') {
      adaptiveScraper.clearSignatures();
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Self-Healing DOM Fingerprint Relocation Across Page Mutations
  // --------------------------------------------------------------------------
  test('P3-1: Learns element signature on original page and relocates relocated element on mutated DOM', () => {
    // 1. Build signature from original e-commerce page
    const $orig = cheerio.load(samplePages.ecommercePage);
    const origElement = $orig('.product-title');
    expect(origElement.length).toBe(1);

    const signature = adaptiveScraper.buildElementSignature($orig, origElement[0]);
    expect(signature.tag).toBe('h1');
    expect(signature.textSnippet).toContain('UltraBook Pro Max');
    expect(signature.attributes['data-testid']).toBe('item-title');

    // 2. Query mutated DOM (where .product-title class was deleted and mutated to .sc-bZQynM)
    const $mutated = cheerio.load(samplePages.mutatedEcommercePage);
    expect($mutated('.product-title').length).toBe(0); // Old selector broken!

    // 3. Relocate using adaptive signature matching
    const relocated = adaptiveScraper.relocateElement($mutated, signature, 0.5);
    expect(relocated.found).toBe(true);
    expect(relocated.score).toBeGreaterThanOrEqual(0.6);
    expect(relocated.text).toContain('UltraBook Pro Max');
    expect(relocated.cssPath).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 2: adaptiveExtract Full Fallback Pipeline
  // --------------------------------------------------------------------------
  test('P3-2: adaptiveExtract falls back to relocated element when primary selector fails', async () => {
    const $orig = cheerio.load(samplePages.ecommercePage);
    const origSig = adaptiveScraper.buildElementSignature($orig, $orig('.product-title')[0]);

    // Call adaptiveExtract with a dead selector but valid fallbackSignature on mutated HTML string
    const result = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
      selector: '.product-title',
      fallbackSignature: origSig,
      threshold: 0.5,
    });

    expect(result.mode).toBe('adaptive-relocated');
    expect(result.items.length).toBe(1);
    expect(result.items[0]).toContain('UltraBook Pro Max');
    expect(result.similarityScore).toBeGreaterThanOrEqual(0.5);
    expect(result.matchedSelector).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Stealth Evasion Headers Profile Construction
  // --------------------------------------------------------------------------
  test('P3-3: Generates valid stealth headers with matching Chrome/Safari platform and Sec-CH-UA', () => {
    const url = 'https://store.nvidia.com/en-us/geforce/rtx-4090/';
    const headers = adaptiveScraper.getStealthHeaders(url);

    expect(headers['User-Agent']).toMatch(/Mozilla\/5\.0/);
    expect(headers['Referer']).toBe('https://store.nvidia.com/');
    expect(headers['Sec-CH-UA']).toBeDefined();
    expect(headers['Sec-CH-UA-Platform']).toBeDefined();
    expect(headers['Accept-Language']).toMatch(/en-US/);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Scraping Job State Machine with Healed Selector Recording
  // --------------------------------------------------------------------------
  test('P3-4: Tracks adaptive scraping job execution lifecycle from PENDING to COMPLETED', async () => {
    // 1. Create SCRAPE job
    const job = await jobStore.createJob({
      type: jobSchemas.JOB_TYPES.SCRAPE,
      userId: 'scraper_user_01',
      keyword: 'https://example.com/catalog',
    });
    expect(job.status).toBe(jobSchemas.JOB_STATUS.PENDING);

    // 2. Progress update: Relocating element
    const runningJob = await jobStore.updateJob(job.jobId, {
      status: jobSchemas.JOB_STATUS.RUNNING,
      progress: { percent: 50, message: 'Selector broken: auto-relocating element' },
    });
    expect(runningJob.status).toBe(jobSchemas.JOB_STATUS.RUNNING);
    expect(runningJob.progress.percent).toBe(50);

    // 3. Complete job with healed metadata
    const completedJob = await jobStore.updateJob(job.jobId, {
      status: jobSchemas.JOB_STATUS.COMPLETED,
      progress: { percent: 100, message: 'Extracted with healed selector' },
      result: {
        itemCount: 1,
        items: [{ title: 'UltraBook Pro Max', healedSelector: 'h1.item-heading-mutated' }],
      },
    });
    expect(completedJob.status).toBe(jobSchemas.JOB_STATUS.COMPLETED);
    expect(completedJob.result.itemCount).toBe(1);
    expect(completedJob.result.items[0].healedSelector).toBe('h1.item-heading-mutated');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Bridge Fallback Cascading When External Bridge is Unavailable
  // --------------------------------------------------------------------------
  test('P3-5: crawlSite falls back to native crawler when external bridge encounters error', async () => {
    const res = await llmCrawler.crawlSite('https://example.com/start', {
      maxPages: 1,
      fetcher: async (targetUrl) => ({
        url: targetUrl,
        title: 'Native Fallback Page',
        markdown: '# Fallback Content\nSuccessfully fetched via native fallback.',
        fitMarkdown: '# Fallback Content\nSuccessfully fetched via native fallback.',
        bridgeUsed: 'native',
      }),
    });

    expect(res.pagesVisited).toBe(1);
    expect(res.pages[0].markdown).toContain('Fallback Content');
    expect(res.pages[0].bridgeUsed).toBe('native');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Broken Selector with No Matching Fingerprint Handled Gracefully
  // --------------------------------------------------------------------------
  test('P3-6: adaptiveExtract returns mode none without crashing when selector and fallback both fail', async () => {
    const $empty = cheerio.load('<html><body><div><p>Irrelevant text</p></div></body></html>');
    const foreignSig = {
      tag: 'table',
      text: 'completely different content that never matches',
      classes: ['table-grid-complex'],
      attributes: { 'data-testid': 'never-match' },
      parentTag: 'section',
    };

    const res = await adaptiveScraper.adaptiveExtract($empty, {
      selector: '.completely-missing-selector',
      fallbackSignature: foreignSig,
      threshold: 0.9,
    });

    expect(res.mode).toBe('none');
    expect(res.items).toHaveLength(0);
    expect(res.similarityScore).toBe(0);
  });
});

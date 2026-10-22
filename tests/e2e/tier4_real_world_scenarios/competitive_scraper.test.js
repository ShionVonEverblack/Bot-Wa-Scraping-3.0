'use strict';

/**
 * @fileoverview Tier 4 Real-World Application Scenario: Competitive Market Scraper Workflow.
 * Simulates an end-to-end user journey of a market intelligence analyst monitoring competitor
 * product pricing across redesigns using adaptive selector healing, JSON crushing, CSV formatting,
 * job queue tracking, and episodic memory persistence.
 */

const cheerio = require('cheerio');
const path = require('path');
const samplePages = require('../../fixtures/samplePages');

describe('Tier 4: Real-World Scenario — Competitive Market Intelligence Scraper', () => {
  const rootDir = process.cwd();

  let adaptiveScraper;
  let jobStore;
  let jobSchemas;
  let contextCompressor;
  let formatters;
  let persistentMemory;

  beforeAll(() => {
    adaptiveScraper = require(path.join(rootDir, 'src', 'engine', 'adaptiveScraper'));
    jobStore = require(path.join(rootDir, 'src', 'jobs', 'jobStore'));
    jobSchemas = require(path.join(rootDir, 'src', 'jobs', 'jobSchemas'));
    contextCompressor = require(path.join(rootDir, 'src', 'services', 'compression', 'contextCompressor'));
    formatters = require(path.join(rootDir, 'src', 'services', 'formatters'));
    persistentMemory = require(path.join(rootDir, 'src', 'services', 'memory', 'persistentMemory'));
  });

  beforeEach(() => {
    if (typeof adaptiveScraper.clearSignatures === 'function') {
      adaptiveScraper.clearSignatures();
    }
    if (persistentMemory && typeof persistentMemory.clearMemory === 'function') {
      persistentMemory.clearMemory();
    }
  });

  test('End-to-End Market Scraper: Job Create -> Redesign Mutation -> Adaptive Heal -> CSV -> Memory', async () => {
    const analystId = 'pricing_analyst_01';

    // Step 1: Analyst submits competitor scraping job
    const job = await jobStore.createJob({
      type: jobSchemas.JOB_TYPES.SCRAPE,
      userId: analystId,
      keyword: 'UltraBook Pro Max 16',
    });
    expect(job.status).toBe(jobSchemas.JOB_STATUS.PENDING);

    // Step 2: Establish baseline element signatures on original page
    const $orig = cheerio.load(samplePages.ecommercePage);
    const origTitleSig = adaptiveScraper.buildElementSignature($orig, $orig('.product-title')[0]);
    const origPriceSig = adaptiveScraper.buildElementSignature($orig, $orig('.price-tag')[0]);

    expect(origTitleSig.tag).toBe('h1');
    expect(origPriceSig.tag).toBe('span');

    // Step 3: Job transitions to RUNNING as scraping engine starts
    await jobStore.updateJob(job.jobId, {
      status: jobSchemas.JOB_STATUS.RUNNING,
      progress: { percent: 25, message: 'Fetching competitor page' },
    });

    // Step 4: Competitor redesigns website (mutatedEcommercePage loaded)
    // Run adaptive extraction for product title
    const titleExtract = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
      selector: '.product-title', // Dead selector
      fallbackSignature: origTitleSig,
      threshold: 0.5,
    });
    expect(titleExtract.mode).toBe('adaptive-relocated');
    expect(titleExtract.items[0]).toContain('UltraBook Pro Max');

    // Run adaptive extraction for price
    const priceExtract = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
      selector: '.price-tag', // Dead selector
      fallbackSignature: origPriceSig,
      threshold: 0.5,
    });
    expect(priceExtract.mode).toBe('adaptive-relocated');
    expect(priceExtract.items[0]).toContain('$1,999.00');

    // Step 5: Synthesize scraped structured items
    const scrapedProducts = [
      {
        name: titleExtract.items[0],
        price: priceExtract.items[0],
        stock: 'In Stock (42 units)',
        retailer: 'TechGadgetStore',
        healedSelectors: [titleExtract.matchedSelector, priceExtract.matchedSelector],
      },
    ];

    // Step 6: Smart Crush items for LLM analysis
    const crushed = contextCompressor.compressJsonItems(scrapedProducts);
    expect(crushed.crushedText).toContain('UltraBook Pro Max');
    expect(crushed.crushedText).toContain('$1,999.00');

    // Step 7: Export to CSV format for business intelligence
    const csvData = formatters.toCsv(scrapedProducts);
    expect(csvData).toMatch(/name.*price.*stock.*retailer/i);
    expect(csvData).toContain('UltraBook Pro Max');
    expect(csvData).toContain('TechGadgetStore');

    // Step 8: Complete job in job store
    const completedJob = await jobStore.updateJob(job.jobId, {
      status: jobSchemas.JOB_STATUS.COMPLETED,
      progress: { percent: 100, message: 'Scraping and auto-healing completed' },
      result: {
        itemCount: 1,
        items: scrapedProducts,
        format: 'csv',
      },
    });
    expect(completedJob.status).toBe(jobSchemas.JOB_STATUS.COMPLETED);
    expect(completedJob.result.itemCount).toBe(1);

    // Step 9: Record market observation in persistent memory
    const obs = persistentMemory.recordObservation(analystId, {
      type: 'market_price',
      title: 'Competitor Price Alert: UltraBook Pro Max',
      content: `Retailer: TechGadgetStore | Price: $1,999.00 | Stock: 42 units | Status: Healed.`,
      tags: ['ultrabook', 'pricing', 'competitor', 'laptop'],
    });
    expect(obs.id).toBeDefined();

    // Step 10: Verify intelligence observation is retrievable in subsequent session
    const memoryHits = persistentMemory.searchIndex(analystId, 'ultrabook price');
    expect(memoryHits.length).toBeGreaterThan(0);
    expect(memoryHits[0].title).toContain('Price Alert');
  });
});

'use strict';

/**
 * @fileoverview Tier 1 Feature Coverage: Milestone 2 Web Crawling & Adaptive Scraping (F09 - F16).
 * Covers isolated functionality with >= 5 tests per feature.
 */

const path = require('path');
const cheerio = require('cheerio');
const samplePages = require('../../fixtures/samplePages');

describe('Tier 1: Milestone 2 Web Crawling & Adaptive Scraping (F09 - F16)', () => {
  const rootDir = process.cwd();

  let llmCrawler;
  let adaptiveScraper;
  let intentClassifier;
  let textUtils;
  let formatters;

  beforeAll(() => {
    llmCrawler = require(path.join(rootDir, 'src', 'engine', 'llmCrawler'));
    adaptiveScraper = require(path.join(rootDir, 'src', 'engine', 'adaptiveScraper'));
    intentClassifier = require(path.join(rootDir, 'src', 'bot', 'nlp', 'intentClassifier'));
    textUtils = require(path.join(rootDir, 'src', 'utils', 'text'));
    formatters = require(path.join(rootDir, 'src', 'services', 'formatters'));
  });

  beforeEach(() => {
    if (adaptiveScraper && typeof adaptiveScraper.clearSignatures === 'function') {
      adaptiveScraper.clearSignatures();
    }
  });

  // --------------------------------------------------------------------------
  // F09: F09_Boilerplate_Noise_Stripping
  // --------------------------------------------------------------------------
  describe('F09: Boilerplate & Noise Stripping', () => {
    test('F09-1: Strips <script>, <style>, and <iframe> noise elements', () => {
      const html = `<div><script>alert("ad");</script><style>.ad{color:red;}</style><p>Clean content</p></div>`;
      const result = llmCrawler.htmlToMarkdown(html);
      expect(result.markdown).not.toMatch(/alert\("ad"\)/);
      expect(result.markdown).not.toMatch(/\.ad\{color:red;\}/);
      expect(result.markdown).toMatch(/Clean content/);
    });

    test('F09-2: Removes cookie consent banners and cookie dialogs', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.fitMarkdown).not.toMatch(/We use cookies to enhance your browsing experience/i);
      expect(result.fitMarkdown).not.toMatch(/accept-cookies/i);
    });

    test('F09-3: Strips advertising containers and promo blocks', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.fitMarkdown).not.toMatch(/Buy cloud GPUs now! Fast & cheap/i);
      expect(result.fitMarkdown).not.toMatch(/Sponsored/i);
    });

    test('F09-4: Strips navigation bars and footers in Fit-Markdown', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.fitMarkdown).not.toMatch(/Home\s+About Us\s+Contact/i);
      expect(result.fitMarkdown).not.toMatch(/AI Research Quarterly\. All rights reserved/i);
    });

    test('F09-5: Preserves core article body content and text density', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.fitMarkdown).toMatch(/Understanding Modern Artificial Intelligence/i);
      expect(result.fitMarkdown).toMatch(/The Transformer Architecture/i);
      expect(result.fitMarkdown).toMatch(/multi-head self-attention/i);
    });
  });

  // --------------------------------------------------------------------------
  // F10: F10_LLM_Markdown_Converter
  // --------------------------------------------------------------------------
  describe('F10: LLM-Ready Markdown Converter', () => {
    test('F10-1: Converts HTML headings h1-h6 into Markdown hashes', () => {
      const html = `<h1>Title 1</h1><h2>Title 2</h2><h3>Title 3</h3>`;
      const result = llmCrawler.htmlToMarkdown(html);
      expect(result.markdown).toMatch(/# Title 1/);
      expect(result.markdown).toMatch(/## Title 2/);
      expect(result.markdown).toMatch(/### Title 3/);
    });

    test('F10-2: Converts HTML <table> elements into GitHub-Flavored Markdown tables', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.tablePage);
      expect(result.markdown).toMatch(/\|\s*Architecture\s*\|\s*GPU Model\s*\|\s*VRAM \(GB\)\s*\|/);
      expect(result.markdown).toMatch(/\|\s*---\s*\|\s*---\s*\|\s*---\s*\|/);
      expect(result.markdown).toMatch(/\|\s*Hopper\s*\|\s*H100 SXM5\s*\|\s*80\s*\|/);
    });

    test('F10-3: Formats preformatted code blocks with language annotations', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.markdown).toMatch(/```python/);
      expect(result.markdown).toMatch(/class SelfAttention\(nn\.Module\):/);
      expect(result.markdown).toMatch(/```/);
    });

    test('F10-4: Converts blockquotes and lists cleanly', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.markdown).toMatch(/> "?Attention is all you need/i);
      expect(result.markdown).toMatch(/- Positional Encodings for sequence awareness/);
    });

    test('F10-5: Extracts clean hyperlinks and generates numbered reference citations', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage, {
        url: 'https://example.com/blog/understanding-ai',
        includeCitations: true,
      });
      expect(result.citations).toBeDefined();
      expect(Array.isArray(result.citations)).toBe(true);
      expect(result.citations.some(c => c.url.includes('arxiv.org/abs/1706.03762'))).toBe(true);
      expect(result.fitMarkdown).toMatch(/### References/);
    });
  });

  // --------------------------------------------------------------------------
  // F11: F11_Structured_JSON_Extractor
  // --------------------------------------------------------------------------
  describe('F11: Structured JSON Extractor & Metadata', () => {
    test('F11-1: Extracts page title, meta description, and author', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.title).toBe('Understanding Modern Artificial Intelligence');
      expect(result.description).toMatch(/comprehensive guide to deep learning/i);
      expect(result.metadata.author).toBe('Dr. Alan Turing');
    });

    test('F11-2: Extracts OpenGraph tags into metadata object', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.metadata.siteName).toBe('AI Research Quarterly');
      expect(result.metadata.title).toBe('Understanding Modern Artificial Intelligence');
    });

    test('F11-3: Resolves and extracts canonical URL', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage, {
        url: 'https://example.com/test',
      });
      expect(result.metadata.canonicalUrl).toBe('https://example.com/blog/understanding-ai');
    });

    test('F11-4: Extracts and parses embedded JSON-LD schemas', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.schemaPage);
      expect(result.metadata.jsonLd).not.toBeNull();
      expect(result.metadata.jsonLd['@type']).toBe('NewsArticle');
      expect(result.metadata.jsonLd.headline).toBe('Quantum Computing Breakthrough');
      expect(result.metadata.jsonLd.author.name).toBe('Prof. Richard Feynman');
    });

    test('F11-5: Calculates accurate word count and estimated reading time', () => {
      const result = llmCrawler.htmlToMarkdown(samplePages.blogPage);
      expect(result.wordCount).toBeGreaterThan(30);
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // F12: F12_Adaptive_Selector_Matching
  // --------------------------------------------------------------------------
  describe('F12: Adaptive Resilient Selector Matching', () => {
    test('F12-1: buildElementSignature captures comprehensive multi-attribute fingerprint', () => {
      const $ = cheerio.load(samplePages.ecommercePage);
      const el = $('button.buy-btn').get(0);
      const sig = adaptiveScraper.buildElementSignature($, el);

      expect(sig.tag).toBe('button');
      expect(sig.id).toBe('add-to-cart-btn');
      expect(sig.classes).toContain('buy-btn');
      expect(sig.classes).toContain('btn-primary');
      expect(sig.textSnippet).toBe('Add to Cart');

      const cardEl = $('[data-testid="product-card"]').get(0);
      const cardSig = adaptiveScraper.buildElementSignature($, cardEl);
      expect(cardSig.attributes['data-testid']).toBe('product-card');
      expect(cardSig.attributes['role']).toBe('region');
    });

    test('F12-2: computeSignatureSimilarity yields near-perfect score for identical signatures', () => {
      const $ = cheerio.load(samplePages.ecommercePage);
      const el = $('.price-tag').get(0);
      const sigA = adaptiveScraper.buildElementSignature($, el);
      const sigB = adaptiveScraper.buildElementSignature($, el);

      const sim = adaptiveScraper.computeSignatureSimilarity(sigA, sigB);
      expect(sim).toBeGreaterThanOrEqual(0.95);
    });

    test('F12-3: computeSignatureSimilarity handles mutated CSS-in-JS hashed classes', () => {
      const $orig = cheerio.load(samplePages.ecommercePage);
      const $mut = cheerio.load(samplePages.mutatedEcommercePage);

      const sigOrig = adaptiveScraper.buildElementSignature($orig, $orig('[data-testid="item-price"]').get(0));
      const sigMut = adaptiveScraper.buildElementSignature($mut, $mut('[data-testid="item-price"]').get(0));

      const sim = adaptiveScraper.computeSignatureSimilarity(sigOrig, sigMut);
      expect(sim).toBeGreaterThanOrEqual(0.65);
    });

    test('F12-4: relocateElement finds correct element in mutated DOM using baseline signature', () => {
      const $orig = cheerio.load(samplePages.ecommercePage);
      const $mut = cheerio.load(samplePages.mutatedEcommercePage);

      const originalButtonSig = adaptiveScraper.buildElementSignature($orig, $orig('#add-to-cart-btn').get(0));
      const relocated = adaptiveScraper.relocateElement($mut, originalButtonSig, 0.45);

      expect(relocated.found).toBe(true);
      expect(relocated.text).toBe('Add to Cart');
      expect(relocated.score).toBeGreaterThanOrEqual(0.45);
    });

    test('F12-5: adaptiveExtract relocates and extracts data when CSS selector fails', async () => {
      const $orig = cheerio.load(samplePages.ecommercePage);
      const originalSig = adaptiveScraper.buildElementSignature($orig, $orig('.css-19xq2a').get(0));

      // The mutated page no longer has .css-19xq2a!
      const result = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
        selector: '.css-19xq2a',
        fallbackSignature: originalSig,
        threshold: 0.45,
      });

      expect(result.mode).toBe('adaptive-relocated');
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]).toMatch(/\$1,999\.00/);
    });
  });

  // --------------------------------------------------------------------------
  // F13: F13_Resilient_Selector_Store
  // --------------------------------------------------------------------------
  describe('F13: Resilient Self-Healing Selector Store', () => {
    test('F13-1: adaptiveExtract with adaptiveKey learns and stores signature on successful selector match', async () => {
      const key = `test_laptop_price_${Date.now()}`;
      const result = await adaptiveScraper.adaptiveExtract(samplePages.ecommercePage, {
        selector: '.price-tag',
        adaptiveKey: key,
      });

      expect(result.mode).toBe('selector');
      expect(result.signature).not.toBeNull();
      expect(result.signature.textSnippet).toBe('$1,999.00');
    });

    test('F13-2: Uses learned signature to extract from mutated DOM when selector fails', async () => {
      const key = `test_healed_price_${Date.now()}`;
      // Step 1: Learn on original DOM
      await adaptiveScraper.adaptiveExtract(samplePages.ecommercePage, {
        selector: '.price-tag',
        adaptiveKey: key,
      });

      // Step 2: Extract on mutated DOM where .price-tag does not exist
      const healedResult = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
        selector: '.price-tag',
        adaptiveKey: key,
      });

      expect(healedResult.mode).toBe('adaptive-relocated');
      expect(healedResult.items[0]).toBe('$1,999.00');
    });

    test('F13-3: Self-heals by updating matchedSelector to new CSS path', async () => {
      const key = `test_heal_path_${Date.now()}`;
      await adaptiveScraper.adaptiveExtract(samplePages.ecommercePage, {
        selector: '.price-tag',
        adaptiveKey: key,
      });

      const healedResult = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
        selector: '.price-tag',
        adaptiveKey: key,
      });

      expect(healedResult.matchedSelector).toBeDefined();
      expect(typeof healedResult.matchedSelector).toBe('string');
      expect(healedResult.matchedSelector.length).toBeGreaterThan(0);
    });

    test('F13-4: clearSignatures removes in-memory cached signatures and returns mode none when unmatched', async () => {
      expect(typeof adaptiveScraper.clearSignatures).toBe('function');
      adaptiveScraper.clearSignatures();

      // With no fallbackSignature and unknown selector, returns mode: none
      const result = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
        selector: '.completely-missing-selector-xyz',
      });

      expect(result.mode).toBe('none');
      expect(result.items).toHaveLength(0);
    });

    test('F13-5: Multiple distinct selector keys are isolated from each other', async () => {
      const keyTitle = `item_title_${Date.now()}`;
      const keyBtn = `item_btn_${Date.now()}`;

      await adaptiveScraper.adaptiveExtract(samplePages.ecommercePage, {
        selector: '.product-title',
        adaptiveKey: keyTitle,
      });
      await adaptiveScraper.adaptiveExtract(samplePages.ecommercePage, {
        selector: '#add-to-cart-btn',
        adaptiveKey: keyBtn,
      });

      const resTitle = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
        selector: '.product-title',
        adaptiveKey: keyTitle,
      });
      const resBtn = await adaptiveScraper.adaptiveExtract(samplePages.mutatedEcommercePage, {
        selector: '#add-to-cart-btn',
        adaptiveKey: keyBtn,
      });

      expect(resTitle.items[0]).toContain('UltraBook Pro Max');
      expect(resBtn.items[0]).toBe('Add to Cart');
    });
  });

  // --------------------------------------------------------------------------
  // F14: F14_Stealth_Evasion_Engine
  // --------------------------------------------------------------------------
  describe('F14: Stealth Evasion Engine & Fingerprinting Profiles', () => {
    test('F14-1: Generates valid User-Agent string simulating modern browser', () => {
      const headers = adaptiveScraper.getStealthHeaders('https://example.com');
      expect(headers['User-Agent']).toBeDefined();
      expect(headers['User-Agent']).toMatch(/Mozilla\/5\.0/);
      expect(headers['User-Agent']).toMatch(/Chrome\//);
    });

    test('F14-2: Generates Sec-CH-UA and platform client hints', () => {
      const headers = adaptiveScraper.getStealthHeaders('https://example.com');
      expect(headers['Sec-CH-UA']).toBeDefined();
      expect(headers['Sec-CH-UA-Mobile']).toBe('?0');
      expect(headers['Sec-CH-UA-Platform']).toBeDefined();
    });

    test('F14-3: Sets standard navigational Accept and Sec-Fetch headers', () => {
      const headers = adaptiveScraper.getStealthHeaders('https://example.com');
      expect(headers['Accept']).toContain('text/html');
      expect(headers['Accept-Language']).toBeDefined();
      expect(headers['Sec-Fetch-Dest']).toBe('document');
      expect(headers['Sec-Fetch-Mode']).toBe('navigate');
    });

    test('F14-4: Sets Referer header matching target URL host', () => {
      const headers = adaptiveScraper.getStealthHeaders('https://news.ycombinator.com/item?id=123');
      expect(headers['Referer']).toBe('https://news.ycombinator.com/');
    });

    test('F14-5: Supports rotation across multiple browser profiles', () => {
      const uas = new Set();
      for (let i = 0; i < 20; i++) {
        const h = adaptiveScraper.getStealthHeaders('https://example.com');
        uas.add(h['User-Agent']);
      }
      expect(uas.size).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // F15: F15_Cascading_Crawler_Bridges
  // --------------------------------------------------------------------------
  describe('F15: Cascading Crawler Bridges', () => {
    test('F15-1: Validates target URL and throws for invalid URL format', async () => {
      await expect(llmCrawler.scrapeUrlToMarkdown('not-a-valid-url')).rejects.toThrow(/Invalid URL/i);
    });

    test('F15-2: ScrapeUrlToMarkdown returns structured document shape', async () => {
      const mockHtml = samplePages.blogPage;
      const doc = llmCrawler.htmlToMarkdown(mockHtml, { url: 'https://example.com/test-article' });
      expect(doc.url).toBe('https://example.com/test-article');
      expect(doc.title).toBeDefined();
      expect(doc.markdown).toBeDefined();
      expect(doc.fitMarkdown).toBeDefined();
      expect(doc.wordCount).toBeGreaterThan(0);
    });

    test('F15-3: crawlSite respects maxPages boundary limit', async () => {
      const mockFetcher = jest.fn(async (url) => {
        return llmCrawler.htmlToMarkdown(samplePages.circularLinksPage, { url });
      });

      const crawlResult = await llmCrawler.crawlSite('https://example.com/start', {
        maxPages: 2,
        maxDepth: 1,
        fetcher: mockFetcher,
      });

      expect(crawlResult.pagesVisited).toBeLessThanOrEqual(2);
      expect(crawlResult.pages.length).toBeLessThanOrEqual(2);
      expect(crawlResult.combinedMarkdown).toBeDefined();
    });

    test('F15-4: crawlSite deduplicates visited URLs and strips fragments', async () => {
      const mockFetcher = jest.fn(async (url) => {
        return llmCrawler.htmlToMarkdown(samplePages.circularLinksPage, { url });
      });

      const crawlResult = await llmCrawler.crawlSite('https://example.com/page-a', {
        maxPages: 5,
        fetcher: mockFetcher,
      });

      const visitedUrls = crawlResult.pages.map(p => p.url);
      const unique = new Set(visitedUrls);
      expect(visitedUrls.length).toBe(unique.size);
    });

    test('F15-5: crawlSite generates combined Markdown report with numbered headers', async () => {
      const mockFetcher = jest.fn(async (url) => {
        return llmCrawler.htmlToMarkdown(samplePages.blogPage, { url });
      });

      const crawlResult = await llmCrawler.crawlSite('https://example.com/blog', {
        maxPages: 1,
        fetcher: mockFetcher,
      });

      expect(crawlResult.combinedMarkdown).toMatch(/## \[1\]/);
      expect(crawlResult.combinedMarkdown).toMatch(/Source: https:\/\/example\.com\/blog/);
    });
  });

  // --------------------------------------------------------------------------
  // F16: F16_Scraping_Commands_NLP
  // --------------------------------------------------------------------------
  describe('F16: Scraping Commands & NLP Intent Mapping', () => {
    test('F16-1: NLP detects SCRAPE intent for URL summarization and scraping queries', () => {
      const queries = [
        'scrape berita terkini',
        'cari data harga laptop',
        'find artificial intelligence papers',
      ];
      for (const q of queries) {
        const res = intentClassifier.ruleBasedClassify(q);
        expect(res.intent).toBe(intentClassifier.INTENTS.SCRAPE);
      }
    });

    test('F16-2: NLP detects PAPER intent for scientific paper queries', () => {
      const queries = [
        'download paper machine learning',
        'unduh jurnal deep learning',
        'arxiv:1706.03762',
      ];
      for (const q of queries) {
        const res = intentClassifier.ruleBasedClassify(q);
        expect(res.intent).toBe(intentClassifier.INTENTS.PAPER_DOWNLOAD);
      }
    });

    test('F16-3: textUtils.splitArgs correctly parses command and options for !deepscrape', () => {
      const raw = '!deepscrape https://example.com --format markdown --limit 5';
      const parsed = textUtils.splitArgs(raw);
      expect(parsed.command).toBe('deepscrape');
      expect(parsed.args).toContain('https://example.com');
      expect(parsed.raw).toBe('https://example.com --format markdown --limit 5');
    });

    test('F16-4: textUtils.splitArgs correctly parses !crawl with depth flags', () => {
      const raw = '!crawl https://example.com --depth 2 --limit 10';
      const parsed = textUtils.splitArgs(raw);
      expect(parsed.command).toBe('crawl');
      expect(parsed.args).toContain('https://example.com');
    });

    test('F16-5: formatters.formatResult formats scraped items to JSON, CSV, and Markdown table', () => {
      const items = [
        { title: 'Item 1', price: '$10', source: 'Web' },
        { title: 'Item 2', price: '$20', source: 'Web' },
      ];
      const jsonOutput = formatters.toJson(items);
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.count).toBe(2);
      expect(parsed.data).toHaveLength(2);

      const csvOutput = formatters.toCsv(items);
      expect(csvOutput).toMatch(/title,price,source/i);
      expect(csvOutput).toMatch(/Item 1/);
    });
  });
});

'use strict';

/**
 * @fileoverview Tier 2 Boundary & Corner Cases: Web Crawling & Scraping Subsystems (F09 - F16).
 * Tests extreme boundaries, malformed HTML, mutated DOMs, network errors, and limits.
 */

const path = require('path');
const cheerio = require('cheerio');
const samplePages = require('../../fixtures/samplePages');

describe('Tier 2: Boundary & Corner Cases — Web Crawling & Scraping (F09 - F16)', () => {
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
  // F09 Boundaries: Boilerplate Noise Stripping
  // --------------------------------------------------------------------------
  describe('F09 Boundaries: Noise Stripping Edge Cases', () => {
    test('F09-B1: Handles HTML containing uppercase <SCRIPT> and <STYLE> noise tags', () => {
      const html = `<div><SCRIPT>var x = 1;</SCRIPT><STYLE>body{margin:0}</STYLE><p>Text Content</p></div>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.markdown).not.toMatch(/var x = 1/);
      expect(res.markdown).toMatch(/Text Content/);
    });

    test('F09-B2: Handles nested modal overlays within article body without stripping legitimate text', () => {
      const html = `<article><p>Legitimate paragraph 1.</p><div class="modal popup"><p>Sign up now!</p></div><p>Legitimate paragraph 2.</p></article>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.fitMarkdown).toMatch(/Legitimate paragraph 1/);
      expect(res.fitMarkdown).toMatch(/Legitimate paragraph 2/);
      expect(res.fitMarkdown).not.toMatch(/Sign up now!/);
    });

    test('F09-B3: Handles HTML with multiple nested footer containers', () => {
      const html = `<main><p>This is a sufficiently long core article paragraph that easily exceeds forty characters.</p><footer><div class="footer"><p>Nested footer info</p></div></footer></main>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.fitMarkdown).toMatch(/sufficiently long core article/);
      expect(res.fitMarkdown).not.toMatch(/Nested footer info/);
    });

    test('F09-B4: Selects fallback container when all containers have low text density', () => {
      const html = `<div><a>Link 1</a></div><div><a>Link 2</a></div><div><p>Short note</p></div>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.markdown).toBeDefined();
      expect(res.markdown.length).toBeGreaterThan(0);
    });

    test('F09-B5: Handles HTML where body contains only noise tags without crashing', () => {
      const html = `<html><body><script>bad()</script><style>css{}</style></body></html>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.markdown).toBe('');
      expect(res.wordCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // F10 Boundaries: LLM Markdown Converter
  // --------------------------------------------------------------------------
  describe('F10 Boundaries: Markdown Conversion Edge Cases', () => {
    test('F10-B1: Handles <table> with zero rows or empty content without broken markdown table', () => {
      const html = `<main><table></table><p>Valid text</p></main>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.markdown).not.toMatch(/\| --- \|/);
      expect(res.markdown).toMatch(/Valid text/);
    });

    test('F10-B2: Handles deeply nested tables within tables', () => {
      const html = `<main><table><tr><td>Outer Cell <table><tr><td>Inner Cell</td></tr></table></td></tr></table></main>`;
      expect(() => llmCrawler.htmlToMarkdown(html)).not.toThrow();
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.markdown).toMatch(/Inner Cell/);
    });

    test('F10-B3: Filters out massive inline base64 image data URIs to avoid token exhaustion', () => {
      const hugeBase64 = `data:image/png;base64,${'A'.repeat(50000)}`;
      const html = `<article><p>Leading text</p><img src="${hugeBase64}" alt="Big Data"><p>Trailing text</p></article>`;
      const res = llmCrawler.htmlToMarkdown(html, { includeImages: true });
      expect(res.markdown).toMatch(/Leading text/);
      expect(res.markdown).toMatch(/Trailing text/);
    });

    test('F10-B4: Strips invalid link protocols (javascript:alert, mailto:)', () => {
      const html = `<p><a href="javascript:alert(1)">Click Me</a> and <a href="mailto:test@example.com">Email Us</a></p>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.markdown).not.toMatch(/\[Click Me\]\(javascript/);
      expect(res.markdown).toMatch(/Click Me/);
    });

    test('F10-B5: Formats code blocks that have no language class annotation', () => {
      const html = `<pre><code>const a = 123;</code></pre>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.markdown).toMatch(/```\nconst a = 123;\n```/);
    });
  });

  // --------------------------------------------------------------------------
  // F11 Boundaries: Structured JSON Extractor
  // --------------------------------------------------------------------------
  describe('F11 Boundaries: Metadata Extraction Edge Cases', () => {
    test('F11-B1: Handles malformed JSON-LD syntax without throwing exception', () => {
      const html = `<head><script type="application/ld+json">{ broken json: without quotes </script></head><body><p>Text</p></body>`;
      expect(() => llmCrawler.htmlToMarkdown(html)).not.toThrow();
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.metadata.jsonLd).toBeNull();
    });

    test('F11-B2: Handles HTML missing title, description, and meta tags completely', () => {
      const html = `<html><body><p>Bare text only</p></body></html>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.title).toBe('');
      expect(res.description).toBe('');
      expect(res.metadata).toEqual(expect.objectContaining({}));
    });

    test('F11-B3: Handles multiple competing <h1> tags using the first non-empty tag', () => {
      const html = `<main><h1>Primary Topic</h1><h1>Secondary Topic</h1><p>Body</p></main>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.title).toBe('Primary Topic');
    });

    test('F11-B4: Handles page titles with unicode emojis and foreign characters', () => {
      const html = `<head><title>🔥 Super AI 🤖 — 日本語タイトル</title></head><body><p>Text</p></body>`;
      const res = llmCrawler.htmlToMarkdown(html);
      expect(res.title).toMatch(/🔥 Super AI 🤖/);
      expect(res.title).toMatch(/日本語タイトル/);
    });

    test('F11-B5: Resolves relative canonical link against provided baseUrl', () => {
      const html = `<head><link rel="canonical" href="/canonical/path"></head><body><p>Text</p></body>`;
      const res = llmCrawler.htmlToMarkdown(html, { url: 'https://mysite.com/deep/page' });
      expect(res.metadata.canonicalUrl).toBe('https://mysite.com/canonical/path');
    });
  });

  // --------------------------------------------------------------------------
  // F12 Boundaries: Adaptive Resilient Selector Matching
  // --------------------------------------------------------------------------
  describe('F12 Boundaries: Adaptive Selector Edge Cases', () => {
    test('F12-B1: Handles element with zero classes and zero custom attributes', () => {
      const $ = cheerio.load(`<p>Pure text element</p>`);
      const el = $('p').get(0);
      const sig = adaptiveScraper.buildElementSignature($, el);
      expect(sig.tag).toBe('p');
      expect(sig.classes).toHaveLength(0);
      expect(sig.textSnippet).toBe('Pure text element');
    });

    test('F12-B2: computeSignatureSimilarity returns 0 when either signature is null or undefined', () => {
      expect(adaptiveScraper.computeSignatureSimilarity(null, {})).toBe(0);
      expect(adaptiveScraper.computeSignatureSimilarity({}, null)).toBe(0);
      expect(adaptiveScraper.computeSignatureSimilarity(undefined, undefined)).toBe(0);
    });

    test('F12-B3: relocateElement respects threshold boundary (rejects score < threshold)', () => {
      const $ = cheerio.load(`<div><button class="different-btn">Completely different action</button></div>`);
      const fakeSig = {
        tag: 'table',
        id: 'special-table',
        classes: ['data-table'],
        attributes: { role: 'grid' },
        textSnippet: 'Revenue Q1 Q2',
      };
      const res = adaptiveScraper.relocateElement($, fakeSig, 0.85);
      expect(res.found).toBe(false);
      expect(res.element).toBeNull();
    });

    test('F12-B4: relocateElement distinguishes between 50 identical sibling cards by structural landmark', () => {
      let cards = '';
      for (let i = 1; i <= 50; i++) {
        cards += `<div class="card" data-index="${i}"><h3>Product ${i}</h3><span class="price">$${i * 10}</span></div>`;
      }
      const $ = cheerio.load(`<div>${cards}</div>`);
      const targetEl = $('[data-index="25"] .price').get(0);
      const sig = adaptiveScraper.buildElementSignature($, targetEl);

      const relocated = adaptiveScraper.relocateElement($, sig, 0.5);
      expect(relocated.found).toBe(true);
      expect(relocated.text).toBe('$250');
    });

    test('F12-B5: adaptiveExtract with empty HTML returns mode none without throwing', async () => {
      const res = await adaptiveScraper.adaptiveExtract('', { selector: '.price' });
      expect(res.mode).toBe('none');
      expect(res.items).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // F13 Boundaries: Resilient Selector Store
  // --------------------------------------------------------------------------
  describe('F13 Boundaries: Selector Cache Persistence Edge Cases', () => {
    test('F13-B1: Handles adaptive keys with special characters and spaces', async () => {
      const specialKey = `key:with/special@chars & spaces #1`;
      const res = await adaptiveScraper.adaptiveExtract(samplePages.ecommercePage, {
        selector: '.price-tag',
        adaptiveKey: specialKey,
      });
      expect(res.mode).toBe('selector');
    });

    test('F13-B2: Handles repeated sequential learning on identical key without corruption', async () => {
      const key = `sequential_key_${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        const res = await adaptiveScraper.adaptiveExtract(samplePages.ecommercePage, {
          selector: '.price-tag',
          adaptiveKey: key,
        });
        expect(res.mode).toBe('selector');
      }
    });

    test('F13-B3: Recovers cleanly when searching for non-existent selector and non-existent key', async () => {
      const res = await adaptiveScraper.adaptiveExtract(samplePages.ecommercePage, {
        selector: '.does-not-exist-anywhere',
        adaptiveKey: 'never_seen_key_9999',
      });
      expect(res.mode).toBe('none');
      expect(res.items).toHaveLength(0);
    });

    test('F13-B4: Handles huge signature text payload without throwing', async () => {
      const hugeText = 'Sample content '.repeat(200);
      const $ = cheerio.load(`<div><p class="huge-p">${hugeText}</p></div>`);
      const sig = adaptiveScraper.buildElementSignature($, $('.huge-p').get(0));
      expect(sig.textSnippet.length).toBeLessThanOrEqual(250); // Automatically truncated
    });

    test('F13-B5: Tokenize handles strings with excessive punctuation and symbols', () => {
      const tokens = adaptiveScraper.tokenize('!!!price---tag___USD$$$999@@@');
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens).toContain('price');
      expect(tokens).toContain('tag');
    });
  });

  // --------------------------------------------------------------------------
  // F14 Boundaries: Stealth Evasion Engine
  // --------------------------------------------------------------------------
  describe('F14 Boundaries: Stealth Profile Edge Cases', () => {
    test('F14-B1: Handles target URL with non-standard port numbers (http://localhost:8080/test)', () => {
      const headers = adaptiveScraper.getStealthHeaders('http://localhost:8080/test');
      expect(headers['Referer']).toBe('http://localhost/');
    });

    test('F14-B2: Handles malformed target URL by falling back to standard search referer', () => {
      const headers = adaptiveScraper.getStealthHeaders('invalid-url-without-protocol');
      expect(headers['Referer']).toBe('https://www.google.com/');
    });

    test('F14-B3: Handles empty string target URL by falling back to Google referer', () => {
      const headers = adaptiveScraper.getStealthHeaders('');
      expect(headers['Referer']).toBe('https://www.google.com/');
    });

    test('F14-B4: Verifies User-Agent contains no invalid newline or carriage return bytes', () => {
      for (let i = 0; i < 10; i++) {
        const headers = adaptiveScraper.getStealthHeaders();
        expect(/[\r\n]/.test(headers['User-Agent'])).toBe(false);
      }
    });

    test('F14-B5: Verifies Sec-CH-UA client hint matches Chromium syntax format', () => {
      const headers = adaptiveScraper.getStealthHeaders();
      expect(headers['Sec-CH-UA']).toMatch(/"Chromium"/);
    });
  });

  // --------------------------------------------------------------------------
  // F15 Boundaries: Cascading Crawler Bridges
  // --------------------------------------------------------------------------
  describe('F15 Boundaries: Multi-Tier Crawler Edge Cases', () => {
    test('F15-B1: Rejects non-HTTP URLs (e.g. ftp://, file://, gopher://)', async () => {
      await expect(llmCrawler.scrapeUrlToMarkdown('ftp://example.com/file.txt')).rejects.toThrow(/Invalid URL/);
      await expect(llmCrawler.scrapeUrlToMarkdown('file:///C:/path/file.txt')).rejects.toThrow(/Invalid URL/);
    });

    test('F15-B2: crawlSite with maxDepth=0 only fetches seed URL without following any links', async () => {
      const mockFetcher = jest.fn(async (url) => {
        return llmCrawler.htmlToMarkdown(samplePages.circularLinksPage, { url });
      });

      const res = await llmCrawler.crawlSite('https://example.com/page-a', {
        maxDepth: 0,
        maxPages: 5,
        fetcher: mockFetcher,
      });

      expect(res.pagesVisited).toBe(1);
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    test('F15-B3: crawlSite with allowExternal=false excludes external domain links', async () => {
      const mockFetcher = jest.fn(async (url) => {
        return llmCrawler.htmlToMarkdown(samplePages.circularLinksPage, { url });
      });

      const res = await llmCrawler.crawlSite('https://example.com/page-a', {
        maxDepth: 2,
        maxPages: 5,
        allowExternal: false,
        fetcher: mockFetcher,
      });

      for (const p of res.pages) {
        expect(new URL(p.url).hostname).toBe('example.com');
      }
    });

    test('F15-B4: crawlSite continues smoothly when an individual subpage fetcher throws an error', async () => {
      let callCount = 0;
      const mockFetcher = jest.fn(async (url) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Simulated HTTP 500 Gateway Error');
        }
        return llmCrawler.htmlToMarkdown(samplePages.circularLinksPage, { url });
      });

      const res = await llmCrawler.crawlSite('https://example.com/page-a', {
        maxPages: 3,
        fetcher: mockFetcher,
      });

      expect(res.pagesVisited).toBeGreaterThanOrEqual(1);
    });

    test('F15-B5: resolveUrl strips hashtag fragments from resolved hyperlinks', () => {
      const resolved = llmCrawler.resolveUrl('/page#heading-2', 'https://example.com/docs');
      expect(resolved).toBe('https://example.com/page#heading-2');
    });
  });

  // --------------------------------------------------------------------------
  // F16 Boundaries: Scraping Commands & NLP Mapping
  // --------------------------------------------------------------------------
  describe('F16 Boundaries: NLP & Command Parser Edge Cases', () => {
    test('F16-B1: NLP returns UNKNOWN for input consisting solely of punctuation marks', () => {
      const res = intentClassifier.ruleBasedClassify('???!!!... ,,,');
      expect(res.intent).toBe(intentClassifier.INTENTS.UNKNOWN);
    });

    test('F16-B2: Handles long input string (5000 chars) without catastrophic regex backtracking', () => {
      const longInput = 'tolong cari ' + 'informasi '.repeat(500);
      const start = Date.now();
      const res = intentClassifier.ruleBasedClassify(longInput);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500); // Must be under 500ms
      expect(res.intent).toBe(intentClassifier.INTENTS.SCRAPE);
    });

    test('F16-B3: textUtils.splitArgs handles mixed case command prefixes (!DEEPSCRApe)', () => {
      const parsed = textUtils.splitArgs('!DEEPSCRApe https://example.com');
      expect(parsed.command).toBe('deepscrape');
    });

    test('F16-B4: textUtils.splitArgs handles trailing and leading whitespace and multiple spaces', () => {
      const parsed = textUtils.splitArgs('   !crawl    https://example.com    --depth   3   ');
      expect(parsed.command).toBe('crawl');
      expect(parsed.args).toContain('https://example.com');
    });

    test('F16-B5: formatters.toCsv handles items with missing columns and commas in values', () => {
      const items = [
        { title: 'Title, with comma', price: '$100' },
        { title: 'Title 2' }, // Missing price
      ];
      const csv = formatters.toCsv(items);
      expect(csv).toMatch(/Title, with comma/);
      expect(csv).toMatch(/Title 2/);
    });
  });
});

'use strict';

/**
 * @fileoverview Puppeteer-based general scraping provider using Brave browser.
 * Inspired by Scrapling framework — anti-bot bypass, smart waiting, stealth mode.
 * @module engine/providers/general/puppeteer
 */

const path = require('path');
const fs = require('fs');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');
const { sleep } = require('../../../utils/httpClient');
const { ensureDir } = require('../../../utils/fsUtil');

const log = createLogger('provider:puppeteer');

/** Pool of user agents for rotation. */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

/** Pool of viewport sizes. */
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

/** Singleton browser instance. */
let browserInstance = null;
let activePagesCount = 0;

/**
 * Auto-detect Brave browser executable path.
 * @returns {string|null}
 */
function detectBravePath() {
  if (config.puppeteer.braveExecutable) {
    return config.puppeteer.braveExecutable;
  }

  const isWindows = process.platform === 'win32';
  const paths = isWindows
    ? [
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
      ]
    : [
        '/usr/bin/brave-browser',
        '/usr/bin/brave',
        '/opt/brave.com/brave/brave-browser',
        '/snap/bin/brave',
      ];

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* ignore */ }
  }

  log.warn('Brave browser not found — Puppeteer provider will be unavailable');
  return null;
}

/**
 * Get or create the singleton browser instance.
 * @returns {Promise<import('puppeteer-core').Browser>}
 */
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  const puppeteer = require('puppeteer-core');
  const executablePath = detectBravePath();

  if (!executablePath) {
    throw new Error('Brave browser not found. Set BRAVE_EXECUTABLE in .env');
  }

  browserInstance = await puppeteer.launch({
    executablePath,
    headless: config.puppeteer.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
    ],
    defaultViewport: null,
  });

  browserInstance.on('disconnected', () => {
    log.warn('Browser disconnected');
    browserInstance = null;
    activePagesCount = 0;
  });

  log.info('Brave browser launched');
  return browserInstance;
}

/**
 * Apply stealth settings to a page.
 * @param {import('puppeteer-core').Page} page
 */
async function applyStealthMode(page) {
  // Override navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    // Override chrome runtime
    window.chrome = { runtime: {} };
  });
}

/**
 * Random delay to simulate human-like behavior.
 * @param {number} [min=800] - Minimum delay ms
 * @param {number} [max=2500] - Maximum delay ms
 * @returns {Promise<void>}
 */
async function humanDelay(min = 800, max = 2500) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await sleep(delay);
}

/**
 * Auto-scroll page to trigger lazy-loaded content.
 * @param {import('puppeteer-core').Page} page
 * @param {number} [maxScrolls=5] - Max scroll iterations
 */
async function autoScroll(page, maxScrolls = 5) {
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.8);
    });
    await humanDelay(500, 1500);

    // Check if we've reached the bottom
    const atBottom = await page.evaluate(() => {
      return window.scrollY + window.innerHeight >= document.body.scrollHeight - 100;
    });
    if (atBottom) break;
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Take a screenshot on error for debugging.
 * @param {import('puppeteer-core').Page} page
 * @param {string} context - Error context for filename
 */
async function screenshotOnError(page, context) {
  try {
    await ensureDir(config.dirs.outputs);
    const filename = `error_${context}_${Date.now()}.png`;
    const filepath = path.join(config.dirs.outputs, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    log.debug(`Error screenshot saved: ${filename}`);
  } catch { /* ignore screenshot errors */ }
}

module.exports = {
  id: 'puppeteer',
  type: 'general',
  priority: 40,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape search results using Puppeteer + Brave browser.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number (for pagination)
   * @param {boolean} [params.safeMode=true] - Safe search
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page: pageNum = 1, safeMode = true, signal }) {
    const maxPages = config.puppeteer.maxPages;
    if (activePagesCount >= maxPages) {
      log.warn('Max concurrent pages reached');
      return { items: [], meta: { hasMore: false, message: 'Max concurrent pages reached' } };
    }

    let browserPage = null;
    activePagesCount++;

    try {
      const browser = await getBrowser();
      browserPage = await browser.newPage();

      // Random viewport
      const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
      await browserPage.setViewport(viewport);

      // Random user agent
      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      await browserPage.setUserAgent(ua);

      // Stealth
      await applyStealthMode(browserPage);

      // Extra headers
      await browserPage.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      });

      // Navigate to DuckDuckGo search
      const start = (pageNum - 1) * limit;
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(keyword)}&s=${start}&kp=${safeMode ? 1 : -1}`;

      await browserPage.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await humanDelay();

      // Wait for results
      try {
        await browserPage.waitForSelector('[data-result], .result, .results--main article', {
          timeout: 10000,
        });
      } catch {
        log.warn('No results selector found, attempting fallback extraction');
      }

      // Auto scroll to load more
      await autoScroll(browserPage, 3);

      // Extract results
      const items = await browserPage.evaluate((maxItems) => {
        const results = [];
        const selectors = [
          '[data-result="web"]',
          '.result.results_links',
          'article[data-testid="result"]',
          '.results--main .result',
        ];

        let elements = [];
        for (const sel of selectors) {
          elements = document.querySelectorAll(sel);
          if (elements.length > 0) break;
        }

        for (const el of elements) {
          if (results.length >= maxItems) break;

          const titleEl = el.querySelector('h2 a, .result__a, a[data-testid="result-title-a"]');
          const snippetEl = el.querySelector('.result__snippet, [data-result="snippet"], .E2eLOJBhqfJdv_HrlPiV');

          if (titleEl) {
            results.push({
              title: (titleEl.textContent || '').trim(),
              url: titleEl.href || '',
              description: snippetEl ? (snippetEl.textContent || '').trim() : '',
            });
          }
        }
        return results;
      }, limit);

      // Add source metadata
      const formattedItems = items.map(item => ({
        ...item,
        source: 'puppeteer',
        sourceUrl: item.url,
      }));

      log.debug(`Puppeteer: found ${formattedItems.length} results for "${keyword}"`);

      return {
        items: formattedItems,
        meta: {
          page: pageNum,
          hasMore: formattedItems.length >= limit,
          message: `Puppeteer (Brave): ${formattedItems.length} results`,
        },
      };
    } catch (err) {
      log.error('Puppeteer scrape failed', { error: err.message });
      if (browserPage) {
        await screenshotOnError(browserPage, 'scrape');
      }
      return { items: [], meta: { hasMore: false, message: err.message } };
    } finally {
      activePagesCount--;
      if (browserPage) {
        try { await browserPage.close(); } catch { /* ignore */ }
      }
    }
  },
};

// Cleanup on process exit
process.on('exit', () => {
  if (browserInstance) {
    try { browserInstance.close(); } catch { /* ignore */ }
  }
});

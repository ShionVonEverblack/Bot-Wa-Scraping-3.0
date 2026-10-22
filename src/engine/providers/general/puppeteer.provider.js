'use strict';

/**
 * @fileoverview Puppeteer-based general scraping provider using Brave browser.
 * Uses shared browserPool for efficient singleton browser management.
 * @module engine/providers/general/puppeteer
 */

const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');
const { sleep } = require('../../../utils/httpClient');
const { ensureDir } = require('../../../utils/fsUtil');
const browserPool = require('../../browserPool');
const path = require('path');

const log = createLogger('provider:puppeteer');

/**
 * Random delay to simulate human-like behavior.
 * @param {number} [min=800] - Minimum delay ms
 * @param {number} [max=2500] - Maximum delay ms
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

    const atBottom = await page.evaluate(() => {
      return window.scrollY + window.innerHeight >= document.body.scrollHeight - 100;
    });
    if (atBottom) break;
  }

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
   * Uses shared browser pool — no per-call browser launch.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number (for pagination)
   * @param {boolean} [params.safeMode=true] - Safe search
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page: pageNum = 1, safeMode = true, signal }) {
    let release = null;

    try {
      // Acquire a page from the shared browser pool
      const acquired = await browserPool.acquirePage();
      const browserPage = acquired.page;
      release = acquired.release;

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
      return { items: [], meta: { hasMore: false, message: err.message } };
    } finally {
      // Always release the page back to the pool
      if (release) {
        try { await release(); } catch { /* ignore */ }
      }
    }
  },
};


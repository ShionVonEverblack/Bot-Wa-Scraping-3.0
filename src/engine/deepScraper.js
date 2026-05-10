'use strict';

/**
 * @fileoverview Deep scraper — extracts structured data from a single URL.
 * Inspired by Scrapling framework: smart element finding, anti-bot bypass.
 * @module engine/deepScraper
 */

const config = require('../config');
const { createLogger } = require('../services/monitor/logger');
const { sleep } = require('../utils/httpClient');
const { ensureDir } = require('../utils/fsUtil');
const path = require('path');

const log = createLogger('engine:deepscrape');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
];

/**
 * @typedef {Object} DeepScrapeResult
 * @property {string} url - Source URL
 * @property {string} title - Page title
 * @property {string} description - Meta description
 * @property {Object} meta - OpenGraph and Twitter meta tags
 * @property {Array<{level:number, text:string}>} headings - All headings h1-h6
 * @property {string[]} paragraphs - Main content paragraphs
 * @property {Array<{src:string, alt:string, width:number, height:number}>} images
 * @property {Array<{href:string, text:string, isExternal:boolean}>} links
 * @property {Array<Object[]>} tables - Tables as arrays of row objects
 * @property {Object|null} structuredData - JSON-LD data if present
 */

/**
 * Deep scrape a single URL and extract structured data.
 * @param {string} url - URL to scrape
 * @param {Object} [options]
 * @param {string} [options.extract='all'] - What to extract: all|text|images|links|tables
 * @param {number} [options.timeout=30000] - Page load timeout
 * @param {string} [options.waitFor] - CSS selector to wait for before extraction
 * @returns {Promise<DeepScrapeResult>}
 */
async function deepScrape(url, options = {}) {
  const {
    extract = 'all',
    timeout = 30000,
    waitFor,
  } = options;

  let page = null;

  try {
    const puppeteer = require('puppeteer-core');
    const puppeteerProvider = require('./providers/general/puppeteer.provider');

    // Reuse the browser from puppeteer provider concept — get browser
    const fs = require('fs');
    let executablePath = config.puppeteer.braveExecutable;

    if (!executablePath) {
      const winPaths = [
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      ];
      const linuxPaths = ['/usr/bin/brave-browser', '/usr/bin/brave'];
      const paths = process.platform === 'win32' ? winPaths : linuxPaths;
      executablePath = paths.find(p => { try { return fs.existsSync(p); } catch { return false; } });
    }

    if (!executablePath) {
      throw new Error('Brave browser not found');
    }

    const browser = await puppeteer.launch({
      executablePath,
      headless: config.puppeteer.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    page = await browser.newPage();

    // Stealth
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(ua);
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate
    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    // Wait for specific selector if requested
    if (waitFor) {
      try {
        await page.waitForSelector(waitFor, { timeout: 10000 });
      } catch {
        log.warn(`waitFor selector "${waitFor}" not found`);
      }
    }

    // Human-like delay
    await sleep(1000 + Math.random() * 1500);

    // Auto-scroll to trigger lazy loading
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise(r => setTimeout(r, 500));
      }
      window.scrollTo(0, 0);
    });

    // Extract data from page
    const result = await page.evaluate((extractMode) => {
      const data = { url: location.href };

      // Title
      data.title = document.title || '';

      // Meta
      const metaDesc = document.querySelector('meta[name="description"]');
      data.description = metaDesc ? metaDesc.content : '';

      data.meta = {};
      document.querySelectorAll('meta[property^="og:"], meta[property^="twitter:"]').forEach(el => {
        const prop = el.getAttribute('property') || el.getAttribute('name');
        if (prop) data.meta[prop] = el.content || '';
      });

      // Headings
      if (extractMode === 'all' || extractMode === 'text') {
        data.headings = [];
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
          const level = parseInt(h.tagName.charAt(1), 10);
          const text = (h.textContent || '').trim();
          if (text) data.headings.push({ level, text });
        });
      }

      // Paragraphs (filter out nav/footer/sidebar)
      if (extractMode === 'all' || extractMode === 'text') {
        data.paragraphs = [];
        const excludeSelectors = 'nav, footer, aside, .sidebar, .menu, .nav, .footer, .header, script, style';
        const excludeEls = new Set();
        document.querySelectorAll(excludeSelectors).forEach(el => excludeEls.add(el));

        document.querySelectorAll('p, article p, main p, .content p').forEach(p => {
          let isExcluded = false;
          let parent = p;
          while (parent) {
            if (excludeEls.has(parent)) { isExcluded = true; break; }
            parent = parent.parentElement;
          }
          if (!isExcluded) {
            const text = (p.textContent || '').trim();
            if (text.length > 20) data.paragraphs.push(text);
          }
        });
      }

      // Images
      if (extractMode === 'all' || extractMode === 'images') {
        data.images = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.dataset?.src || '';
          if (src && !src.includes('data:image/svg') && !src.includes('1x1')) {
            data.images.push({
              src,
              alt: img.alt || '',
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0,
            });
          }
        });
      }

      // Links
      if (extractMode === 'all' || extractMode === 'links') {
        data.links = [];
        const baseHost = location.hostname;
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.href || '';
          if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
            let isExternal = false;
            try { isExternal = new URL(href).hostname !== baseHost; } catch { /* ignore */ }
            data.links.push({
              href,
              text: (a.textContent || '').trim().slice(0, 200),
              isExternal,
            });
          }
        });
      }

      // Tables
      if (extractMode === 'all' || extractMode === 'tables') {
        data.tables = [];
        document.querySelectorAll('table').forEach(table => {
          const rows = [];
          const headers = [];

          table.querySelectorAll('thead th, thead td, tr:first-child th').forEach(th => {
            headers.push((th.textContent || '').trim());
          });

          table.querySelectorAll('tbody tr, tr').forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td, th').forEach(td => {
              cells.push((td.textContent || '').trim());
            });
            if (cells.length > 0 && cells.some(c => c)) {
              if (headers.length > 0 && headers.length === cells.length) {
                const rowObj = {};
                headers.forEach((h, i) => { rowObj[h || `col${i}`] = cells[i]; });
                rows.push(rowObj);
              } else {
                rows.push(cells);
              }
            }
          });

          if (rows.length > 0) data.tables.push(rows);
        });
      }

      // JSON-LD structured data
      data.structuredData = null;
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) {
        try { data.structuredData = JSON.parse(jsonLd.textContent); } catch { /* ignore */ }
      }

      return data;
    }, extract);

    log.info(`Deep scrape completed for ${url}`, {
      headings: result.headings?.length || 0,
      paragraphs: result.paragraphs?.length || 0,
      images: result.images?.length || 0,
      links: result.links?.length || 0,
      tables: result.tables?.length || 0,
    });

    await page.close();
    await browser.close();

    return result;
  } catch (err) {
    log.error(`Deep scrape failed for ${url}`, { error: err.message });

    // Screenshot on error
    if (page) {
      try {
        await ensureDir(config.dirs.outputs);
        await page.screenshot({
          path: path.join(config.dirs.outputs, `deepscrape_error_${Date.now()}.png`),
        });
      } catch { /* ignore */ }
      try { await page.close(); } catch { /* ignore */ }
    }

    throw err;
  }
}

module.exports = { deepScrape };

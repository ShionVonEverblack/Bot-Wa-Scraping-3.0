'use strict';

/**
 * @fileoverview Shared browser pool — singleton Brave/Puppeteer instance.
 * Used by both puppeteer.provider and deepScraper to avoid per-call browser launch overhead.
 * @module engine/browserPool
 */

const fs = require('fs');
const config = require('../config');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('engine:browser-pool');

/** User agents for rotation. */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

/** Viewport sizes for rotation. */
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

/** Singleton browser instance. */
let browserInstance = null;

/** Active page count — prevents overflow. */
let activePagesCount = 0;

/** Max concurrent pages. */
const MAX_PAGES = config.puppeteer?.maxPages || 5;

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
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }

  log.warn('Brave browser not found — Puppeteer-based features will be unavailable');
  return null;
}

/**
 * Get or create the singleton browser instance.
 * Reuses existing connected browser; only launches a new one if needed.
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

  log.info('Launching Brave browser...');
  browserInstance = await puppeteer.launch({
    executablePath,
    headless: config.puppeteer.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--disable-dev-shm-usage',       // Prevent /dev/shm overflow in Docker
      '--disable-gpu',                  // Reduce resource usage
      '--single-process',               // Single process mode for stability
    ],
    defaultViewport: null,
  });

  browserInstance.on('disconnected', () => {
    log.warn('Browser disconnected — will re-launch on next request');
    browserInstance = null;
    activePagesCount = 0;
  });

  log.info('Brave browser launched and ready');
  return browserInstance;
}

/**
 * Create a new page with stealth settings applied.
 * @returns {Promise<{ page: import('puppeteer-core').Page, release: () => Promise<void> }>}
 * @throws {Error} If max concurrent pages exceeded
 */
async function acquirePage() {
  if (activePagesCount >= MAX_PAGES) {
    throw new Error(`Max concurrent pages (${MAX_PAGES}) reached. Try again later.`);
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  activePagesCount++;

  // Random viewport
  const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
  await page.setViewport(viewport);

  // Random user agent
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  await page.setUserAgent(ua);

  // Stealth overrides
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  // Extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  });

  log.debug(`Page acquired (${activePagesCount}/${MAX_PAGES} active)`);

  // Release function — always call this when done with the page
  const release = async () => {
    activePagesCount = Math.max(0, activePagesCount - 1);
    try { await page.close(); } catch { /* ignore */ }
    log.debug(`Page released (${activePagesCount}/${MAX_PAGES} active)`);
  };

  return { page, release };
}

/**
 * Get current pool stats.
 * @returns {{ activePages: number, maxPages: number, browserConnected: boolean }}
 */
function getStats() {
  return {
    activePages: activePagesCount,
    maxPages: MAX_PAGES,
    browserConnected: browserInstance ? browserInstance.isConnected() : false,
  };
}

/**
 * Gracefully close the browser instance.
 * @returns {Promise<void>}
 */
async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      log.info('Browser closed');
    } catch (err) {
      log.warn('Browser close error', { error: err.message });
    }
    browserInstance = null;
    activePagesCount = 0;
  }
}

/**
 * Get a random user agent.
 * @returns {string}
 */
function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Cleanup on process exit
process.on('exit', () => {
  if (browserInstance) {
    try { browserInstance.close(); } catch { /* ignore */ }
  }
});

module.exports = {
  getBrowser, acquirePage, getStats, closeBrowser,
  detectBravePath, randomUserAgent,
  USER_AGENTS, VIEWPORTS,
};

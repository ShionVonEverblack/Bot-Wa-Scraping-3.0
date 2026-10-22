'use strict';

/**
 * @fileoverview WhatsApp client setup using whatsapp-web.js with Brave browser.
 * @module bot/client
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { createLogger } = require('../services/monitor/logger');
const dashboard = require('../services/monitor/dashboard');

const log = createLogger('bot:client');

/**
 * Auto-detect Brave browser executable path.
 * @returns {string|null}
 */
function detectBravePath() {
  if (config.puppeteer.braveExecutable) {
    return config.puppeteer.braveExecutable;
  }

  const isWindows = process.platform === 'win32';
  const candidates = isWindows
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

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        log.info(`Brave browser found: ${p}`);
        return p;
      }
    } catch { /* ignore */ }
  }

  return null;
}

/**
 * Create and configure a new WhatsApp client instance.
 * @returns {Client} Configured whatsapp-web.js client
 */
function createClient() {
  const bravePath = detectBravePath();

  if (!bravePath) {
    log.warn('Brave browser not found — using default Chromium bundled with Puppeteer');
  }

  const puppeteerOptions = {
    headless: config.puppeteer.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--disable-blink-features=AutomationControlled',
    ],
  };

  if (bravePath) {
    puppeteerOptions.executablePath = bravePath;
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: config.sessionName,
      dataPath: path.resolve(config.dirs.auth),
    }),
    puppeteer: puppeteerOptions,
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/AhmedAlbishworker/WhatsApp-Web-Versions/main/html/2.2412.54.html' },
  });

  // ─── Event Handlers ───────────────────────────────────────────────

  client.on('qr', (qr) => {
    log.info('QR Code received — scan with WhatsApp:');
    qrcode.generate(qr, { small: true });
    dashboard.setQR(qr);
  });

  client.on('loading_screen', (percent, message) => {
    log.info(`Loading: ${percent}% — ${message}`);
  });

  client.on('authenticated', () => {
    log.info('Authentication successful');
    dashboard.setAuthenticated();
  });

  client.on('auth_failure', (msg) => {
    log.error('Authentication failed', { message: msg });
  });

  client.on('ready', async () => {
    log.info('═══════════════════════════════════════════');
    log.info(`  ${config.botName} is READY! ✅`);
    log.info('═══════════════════════════════════════════');

    // Update dashboard status
    try {
      const info = client.info;
      const userName = info ? (info.pushname || info.wid?.user || 'Unknown') : 'Unknown';
      dashboard.setReady(userName);
    } catch { dashboard.setReady(); }

    // Set ready gate in message handler
    try {
      const { setReady } = require('./messageHandler');
      setReady(true, client);
    } catch (err) {
      log.warn('messageHandler setReady failed', { error: err.message });
    }

    // Resume pending/running jobs from before restart
    try {
      const jobManager = require('../jobs/jobManager');
      const resumed = await jobManager.resumePending(client);
      if (resumed > 0) {
        log.info(`Resumed ${resumed} pending job(s) from previous session`);
      }
    } catch (err) {
      log.warn('Job resume failed', { error: err.message });
    }

    // Restore scheduled watches (cron jobs)
    try {
      const watchService = require('../services/watch');
      const restored = await watchService.restoreWatches(client);
      if (restored > 0) {
        log.info(`Restored ${restored} active watch schedule(s)`);
      }
    } catch (err) {
      log.warn('Watch restore failed', { error: err.message });
    }
  });

  client.on('disconnected', (reason) => {
    log.warn('Client disconnected', { reason });
    dashboard.setDisconnected(reason);
  });

  // ─── Message Handler ──────────────────────────────────────────────

  client.on('message', async (msg) => {
    try {
      const { handleMessage } = require('./messageHandler');
      await handleMessage(msg, client);
    } catch (err) {
      log.error('Message handling error', { error: err.message });
    }
  });

  // Also handle messages created by the bot's own device (for multi-device)
  client.on('message_create', async (msg) => {
    // Only process if from another user (not self)
    if (msg.fromMe) return;
    // Already handled by 'message' event in most cases
  });

  return client;
}

module.exports = { createClient, detectBravePath };

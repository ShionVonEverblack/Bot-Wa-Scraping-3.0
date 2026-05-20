'use strict';

/**
 * @fileoverview Entry point for Bot Scraping WhatsApp 3.0 — Rima.
 * Loads environment, performs health checks, and starts the bot.
 * @module index
 */

// Load environment variables FIRST
require('dotenv').config();

const config = require('./src/config');
const { createLogger } = require('./src/services/monitor/logger');
const { ensureDir } = require('./src/utils/fsUtil');

const log = createLogger('main');

/**
 * Ensure all required working directories exist.
 * @returns {Promise<void>}
 */
async function ensureDirectories() {
  const dirs = Object.values(config.dirs);
  for (const dir of dirs) {
    await ensureDir(dir);
  }
  log.info('All directories verified');
}

/**
 * Perform basic health checks before starting the bot.
 * @returns {Promise<boolean>} true if all checks pass
 */
async function healthCheck() {
  log.info(`Bot: ${config.botName} | Env: ${config.nodeEnv} | Log: ${config.logLevel}`);

  // Check at least one AI provider key is set
  const hasAiKey =
    config.ai.openai.apiKey ||
    config.ai.gemini.apiKey ||
    config.ai.groq.apiKey ||
    config.ai.grok.apiKey;

  if (!hasAiKey) {
    log.warn('No AI provider API key configured — AI features will be unavailable');
  }

  // Check Node.js version
  const nodeVersion = parseInt(process.version.slice(1), 10);
  if (nodeVersion < 18) {
    log.fatal(`Node.js >= 18 required, found ${process.version}`);
    return false;
  }

  return true;
}

/**
 * Main bootstrap function.
 * @returns {Promise<void>}
 */
let manager = null;

async function main() {
  try {
    log.info('═══════════════════════════════════════════');
    log.info(`  ${config.botName} — Bot Scraping WhatsApp 3.0`);
    log.info('═══════════════════════════════════════════');

    // 1. Health check
    const healthy = await healthCheck();
    if (!healthy) {
      process.exit(1);
    }

    // 2. Ensure directories
    await ensureDirectories();

    // 3. Start QR Code Web Dashboard
    try {
      const { startDashboard } = require('./src/services/monitor/dashboard');
      startDashboard();
    } catch (err) {
      log.warn('Dashboard failed to start', { error: err.message });
    }

    // 4. Create client manager and start bot
    log.info('Foundation loaded — ready to initialize WhatsApp client');

    // Lazy-load to avoid circular deps and allow graceful error if module missing
    try {
      const { createClientManager } = require('./src/bot/clientManager');
      manager = createClientManager();
      await manager.start();
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        log.warn('clientManager not yet implemented — bot core pending');
      } else {
        throw err;
      }
    }

    // 5. Schedule automatic job cleanup (daily at 3:00 AM)
    try {
      const cron = require('node-cron');
      const jobStore = require('./src/jobs/jobStore');

      cron.schedule('0 3 * * *', async () => {
        log.info('Running scheduled job cleanup...');
        const result = await jobStore.purgeExpiredJobs({
          maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
          deleteFiles: true,
        });
        if (result.purged > 0) {
          log.info(`Cleanup: ${result.purged} expired jobs purged, ${result.filesDeleted} files deleted`);
        }
      });

      log.info('Job cleanup scheduled (daily at 03:00)');
    } catch (err) {
      log.warn('Job cleanup scheduler failed to initialize', { error: err.message });
    }
  } catch (err) {
    log.fatal('Failed to start bot', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

/**
 * Graceful shutdown — cleanup all resources before exiting.
 * Order: watches → job queue → WhatsApp client (browser).
 * @param {string} signal - Signal name for logging
 */
async function gracefulShutdown(signal) {
  log.info(`Received ${signal} — shutting down gracefully...`);

  // 1. Stop watch cron jobs
  try {
    const watchService = require('./src/services/watch');
    watchService.stopAll();
  } catch { /* not loaded */ }

  // 2. Stop dashboard server
  try {
    const { stopDashboard } = require('./src/services/monitor/dashboard');
    await stopDashboard();
  } catch { /* not loaded */ }

  // 3. Drain job queue (wait for running jobs)
  try {
    const jobQueue = require('./src/jobs/jobQueue');
    await jobQueue.shutdown();
  } catch { /* not loaded */ }

  // 4. Shutdown WhatsApp client (closes browser)
  if (manager) {
    try {
      await manager.shutdown();
    } catch (err) {
      log.error('Client shutdown error', { error: err.message });
    }
  }

  // 5. Close browser pool
  try {
    const browserPool = require('./src/engine/browserPool');
    await browserPool.closeBrowser();
  } catch { /* not loaded */ }

  log.info('Shutdown complete');
  process.exit(0);
}

// Centralized shutdown handlers (single source of truth)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  log.fatal('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.fatal('Unhandled rejection', { reason: String(reason) });
  process.exit(1);
});

// Start
main();

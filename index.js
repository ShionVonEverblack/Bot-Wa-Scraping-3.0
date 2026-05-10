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

    // 3. Create client manager and start bot
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
  } catch (err) {
    log.fatal('Failed to start bot', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

/**
 * Graceful shutdown — cleanup client before exiting.
 * @param {string} signal - Signal name for logging
 */
async function gracefulShutdown(signal) {
  log.info(`Received ${signal} — shutting down gracefully...`);
  if (manager) {
    try {
      await manager.shutdown();
    } catch (err) {
      log.error('Shutdown error', { error: err.message });
    }
  }
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

'use strict';

/**
 * @fileoverview Client manager — handles bot lifecycle, auto-restart, and reconnection.
 * @module bot/clientManager
 */

const { createClient } = require('./client');
const config = require('../config');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('bot:manager');

/**
 * Create a client manager with auto-restart capabilities.
 * @returns {{ start: Function, restart: Function, getClient: Function }}
 */
function createClientManager() {
  let client = null;
  let isShuttingDown = false;
  let restartCount = 0;
  const MAX_RESTARTS = 5;
  const RESTART_DELAY_MS = 5000;

  /**
   * Start the WhatsApp client.
   * @returns {Promise<void>}
   */
  async function start() {
    try {
      log.info('Starting WhatsApp client...');
      client = createClient();

      // Auto-restart on disconnect
      client.on('disconnected', async (reason) => {
        log.warn(`Disconnected: ${reason}`);
        if (!isShuttingDown) {
          await scheduleRestart();
        }
      });

      // Initialize the client (this triggers QR or auto-auth)
      await client.initialize();
    } catch (err) {
      log.error('Client initialization failed', { error: err.message });
      if (!isShuttingDown) {
        await scheduleRestart();
      }
    }
  }

  /**
   * Schedule a restart with delay and max attempt limit.
   * @returns {Promise<void>}
   */
  async function scheduleRestart() {
    restartCount++;

    if (restartCount > MAX_RESTARTS) {
      log.fatal(`Max restart attempts (${MAX_RESTARTS}) reached — giving up`);
      process.exit(1);
    }

    const delay = RESTART_DELAY_MS * restartCount;
    log.info(`Restarting in ${delay / 1000}s (attempt ${restartCount}/${MAX_RESTARTS})...`);

    await new Promise(resolve => setTimeout(resolve, delay));
    await restart();
  }

  /**
   * Restart the client — destroy existing session and create new one.
   * @returns {Promise<void>}
   */
  async function restart() {
    try {
      if (client) {
        log.info('Destroying old client...');
        try {
          await client.destroy();
        } catch (err) {
          log.warn('Error destroying client', { error: err.message });
        }
        client = null;
      }

      await start();
    } catch (err) {
      log.error('Restart failed', { error: err.message });
    }
  }

  /**
   * Graceful shutdown.
   * @returns {Promise<void>}
   */
  async function shutdown() {
    isShuttingDown = true;
    log.info('Shutting down client...');
    if (client) {
      try {
        await client.destroy();
      } catch { /* ignore */ }
    }
  }

  /**
   * Get the current client instance.
   * @returns {Client|null}
   */
  function getClient() {
    return client;
  }

  // Graceful shutdown on process signals
  process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
  });

  return { start, restart, getClient, shutdown };
}

module.exports = { createClientManager };

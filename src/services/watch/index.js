'use strict';

/**
 * @fileoverview Watch service — scheduled recurring scrapes using node-cron.
 * @module services/watch/index
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const config = require('../../config');
const { ensureDir, readJson, writeJson } = require('../../utils/fsUtil');
const { generateJobId } = require('../../utils/id');
const { createLogger } = require('../monitor/logger');

const log = createLogger('watch');

const WATCHES_DIR = config.dirs.watches || './watches';

/** @type {Map<string, { config: Object, task: import('node-cron').ScheduledTask }>} */
const activeWatches = new Map();

/**
 * @typedef {Object} WatchConfig
 * @property {string} watchId - Unique watch ID
 * @property {string} keyword - Search keyword
 * @property {string} type - Scrape type
 * @property {number} limit - Result limit
 * @property {string} schedule - Cron expression or shorthand
 * @property {string} chatId - WhatsApp chat ID
 * @property {string} userId - User ID
 * @property {boolean} active - Whether watch is active
 * @property {string} createdAt - ISO timestamp
 * @property {string|null} lastRun - Last run timestamp
 */

/**
 * Parse a schedule shorthand to cron expression.
 * @param {string} input - "hourly", "daily", "weekly", "every 2h", or cron expression
 * @returns {string} Cron expression
 */
function parseCronExpression(input) {
  const shorthands = {
    'hourly': '0 * * * *',
    'daily': '0 9 * * *',
    'weekly': '0 9 * * 1',
    '12h': '0 */12 * * *',
    '6h': '0 */6 * * *',
    '3h': '0 */3 * * *',
    '2h': '0 */2 * * *',
  };

  const trimmed = input.trim().toLowerCase();

  // Check shorthands
  if (shorthands[trimmed]) return shorthands[trimmed];

  // "every Xh" pattern
  const everyMatch = trimmed.match(/every\s+(\d+)\s*h/);
  if (everyMatch) {
    const hours = parseInt(everyMatch[1], 10);
    return `0 */${hours} * * *`;
  }

  // Raw cron expression
  if (cron.validate(input)) return input;

  return shorthands['daily']; // Default
}

/**
 * Create and start a watch.
 * @param {Object} params
 * @param {string} params.keyword
 * @param {string} params.type
 * @param {number} [params.limit=10]
 * @param {string} params.schedule - Cron/shorthand
 * @param {string} params.chatId
 * @param {string} params.userId
 * @param {Object} client - WhatsApp client
 * @returns {Promise<WatchConfig>}
 */
async function createWatch(params, client) {
  const watchId = `W${generateJobId()}`;
  const cronExpr = parseCronExpression(params.schedule || 'daily');

  const watchConfig = {
    watchId,
    keyword: params.keyword,
    type: params.type || 'general',
    limit: params.limit || 10,
    schedule: cronExpr,
    scheduleRaw: params.schedule,
    chatId: params.chatId,
    userId: params.userId,
    active: true,
    createdAt: new Date().toISOString(),
    lastRun: null,
  };

  // Save to disk
  await ensureDir(WATCHES_DIR);
  await writeJson(path.join(WATCHES_DIR, `${watchId}.json`), watchConfig);

  // Schedule it
  scheduleWatch(watchConfig, client);

  log.info(`Watch created: ${watchId} (${watchConfig.keyword}, ${cronExpr})`);
  return watchConfig;
}

/**
 * Schedule a watch cron job.
 * @param {WatchConfig} watchConfig
 * @param {Object} client
 */
function scheduleWatch(watchConfig, client) {
  const task = cron.schedule(watchConfig.schedule, async () => {
    log.info(`Watch triggered: ${watchConfig.watchId} (${watchConfig.keyword})`);

    try {
      const jobManager = require('../../jobs/jobManager');
      await jobManager.createJob({
        request: {
          type: 'SCRAPE',
          keyword: watchConfig.keyword,
          scrapeType: watchConfig.type,
          limit: watchConfig.limit,
          chatId: watchConfig.chatId,
          userId: watchConfig.userId,
        },
        client,
      });

      // Update last run
      watchConfig.lastRun = new Date().toISOString();
      await writeJson(path.join(WATCHES_DIR, `${watchConfig.watchId}.json`), watchConfig);
    } catch (err) {
      log.error(`Watch ${watchConfig.watchId} failed`, { error: err.message });
    }
  });

  activeWatches.set(watchConfig.watchId, { config: watchConfig, task });
}

/**
 * Stop and remove a watch.
 * @param {string} watchId
 * @returns {Promise<boolean>}
 */
async function removeWatch(watchId) {
  const entry = activeWatches.get(watchId);
  if (entry) {
    entry.task.stop();
    activeWatches.delete(watchId);
  }

  try {
    const filepath = path.join(WATCHES_DIR, `${watchId}.json`);
    await fs.promises.unlink(filepath);
    log.info(`Watch removed: ${watchId}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all watches for a user.
 * @param {string} [userId] - Filter by userId (null = all)
 * @returns {Promise<WatchConfig[]>}
 */
async function listWatches(userId) {
  try {
    await ensureDir(WATCHES_DIR);
    const files = await fs.promises.readdir(WATCHES_DIR);
    const watches = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const w = await readJson(path.join(WATCHES_DIR, file));
      if (w && (!userId || w.userId === userId)) watches.push(w);
    }

    return watches;
  } catch {
    return [];
  }
}

/**
 * Load and restore all active watches on startup.
 * @param {Object} client
 * @returns {Promise<number>} Number of watches restored
 */
async function restoreWatches(client) {
  const watches = await listWatches();
  let count = 0;

  for (const w of watches) {
    if (w.active) {
      scheduleWatch(w, client);
      count++;
    }
  }

  if (count > 0) log.info(`Restored ${count} active watches`);
  return count;
}

/**
 * Stop all active watch cron jobs (for graceful shutdown).
 */
function stopAll() {
  for (const [id, entry] of activeWatches) {
    entry.task.stop();
    log.debug(`Watch stopped: ${id}`);
  }
  const count = activeWatches.size;
  activeWatches.clear();
  if (count > 0) log.info(`All ${count} watches stopped`);
}

module.exports = { createWatch, removeWatch, listWatches, restoreWatches, parseCronExpression, stopAll };

'use strict';

/**
 * @fileoverview Structured logger for Bot Scraping WhatsApp 3.0.
 * Replaces console.log with level-based, timestamped, structured logging.
 * @module services/monitor/logger
 */

const config = require('../../config');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

/**
 * Format a log entry with timestamp, level, module, and message.
 * @param {'debug'|'info'|'warn'|'error'|'fatal'} level
 * @param {string} module - Source module name
 * @param {string} message - Log message
 * @param {Object} [data] - Additional structured data
 * @returns {string}
 */
function formatEntry(level, module, message, data) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${module}]`;
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `${prefix} ${message}${dataStr}`;
}

/**
 * Create a scoped logger for a specific module.
 * @param {string} moduleName - Name of the module (e.g., 'bot:client', 'engine:provider')
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function, fatal: Function }}
 */
function createLogger(moduleName) {
  /**
   * Log at a specific level.
   * @param {'debug'|'info'|'warn'|'error'|'fatal'} level
   * @param {string} message
   * @param {Object} [data]
   */
  function log(level, message, data) {
    if (LEVELS[level] < currentLevel) return;
    const entry = formatEntry(level, moduleName, message, data);
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(entry + '\n');
    } else {
      process.stdout.write(entry + '\n');
    }
  }

  return {
    /** @param {string} msg @param {Object} [data] */
    debug: (msg, data) => log('debug', msg, data),
    /** @param {string} msg @param {Object} [data] */
    info: (msg, data) => log('info', msg, data),
    /** @param {string} msg @param {Object} [data] */
    warn: (msg, data) => log('warn', msg, data),
    /** @param {string} msg @param {Object} [data] */
    error: (msg, data) => log('error', msg, data),
    /** @param {string} msg @param {Object} [data] */
    fatal: (msg, data) => log('fatal', msg, data),
  };
}

module.exports = { createLogger };

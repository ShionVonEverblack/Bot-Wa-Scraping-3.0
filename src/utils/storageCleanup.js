'use strict';

/**
 * @fileoverview Automatic TTL cleanup utility for temporary output files.
 * Prevents disk exhaustion from accumulated scrape exports and brevity guard files.
 * @module utils/storageCleanup
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('utils:cleanup');

/** Default retention: 24 hours in milliseconds. */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Delete files in the target directory that are older than maxAgeMs.
 * Ignores directories and dotfiles (e.g. .gitkeep).
 * @param {string} dirPath - Directory path to clean
 * @param {number} [maxAgeMs=DEFAULT_MAX_AGE_MS] - Maximum file age in ms
 * @returns {Promise<{ deletedCount: number, deletedFiles: string[] }>}
 */
async function cleanOldOutputs(dirPath, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const deletedFiles = [];
  if (!dirPath || !fs.existsSync(dirPath)) {
    return { deletedCount: 0, deletedFiles };
  }

  const now = Date.now();
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);
      try {
        const stat = await fs.promises.stat(fullPath);
        const ageMs = now - stat.mtimeMs;
        if (ageMs > maxAgeMs) {
          await fs.promises.unlink(fullPath);
          deletedFiles.push(entry.name);
        }
      } catch (fileErr) {
        log.debug(`Skipped cleanup of ${entry.name}`, { error: fileErr.message });
      }
    }

    if (deletedFiles.length > 0) {
      log.info(`Cleaned ${deletedFiles.length} expired file(s) from ${dirPath}`);
    }
  } catch (err) {
    log.warn(`Failed to clean directory ${dirPath}`, { error: err.message });
  }

  return { deletedCount: deletedFiles.length, deletedFiles };
}

module.exports = {
  cleanOldOutputs,
  DEFAULT_MAX_AGE_MS,
};

'use strict';

/**
 * @fileoverview File system utility helpers.
 * @module utils/fsUtil
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('utils:fs');

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} dirPath - Path to directory
 * @returns {Promise<void>}
 */
async function ensureDir(dirPath) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (err) {
    log.error(`Failed to create directory: ${dirPath}`, { error: err.message });
    throw err;
  }
}

/**
 * Write a JSON object to a file (pretty-printed).
 * @param {string} filePath - Destination path
 * @param {*} data - Data to serialize
 * @returns {Promise<void>}
 */
async function writeJson(filePath, data) {
  try {
    await ensureDir(path.dirname(filePath));
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    log.error(`Failed to write JSON: ${filePath}`, { error: err.message });
    throw err;
  }
}

/**
 * Write raw content (string or Buffer) to a file.
 * @param {string} filePath - Destination path
 * @param {string|Buffer} content - File content
 * @returns {Promise<void>}
 */
async function writeFile(filePath, content) {
  try {
    await ensureDir(path.dirname(filePath));
    await fs.promises.writeFile(filePath, content);
  } catch (err) {
    log.error(`Failed to write file: ${filePath}`, { error: err.message });
    throw err;
  }
}

/**
 * Read and parse a JSON file.
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<*>} Parsed object, or null on failure
 */
async function readJson(filePath) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    log.error(`Failed to read JSON: ${filePath}`, { error: err.message });
    return null;
  }
}

/**
 * Check if a file exists.
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate total size of a directory recursively (in bytes).
 * @param {string} dirPath - Directory to measure
 * @returns {Promise<number>} Total size in bytes
 */
async function dirSize(dirPath) {
  let total = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await dirSize(fullPath);
      } else {
        const stat = await fs.promises.stat(fullPath);
        total += stat.size;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log.warn(`dirSize error for ${dirPath}`, { error: err.message });
    }
  }
  return total;
}

module.exports = { ensureDir, writeJson, writeFile, readJson, fileExists, dirSize };

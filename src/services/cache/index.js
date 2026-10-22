'use strict';

/**
 * @fileoverview In-memory TTL cache with LRU/FIFO eviction and periodic cleanup.
 * @module services/cache
 */

const config = require('../../config');
const { createLogger } = require('../monitor/logger');

const log = createLogger('cache');

/** Maximum number of entries in cache. */
const MAX_SIZE = 500;

/** Default TTL in milliseconds (from config.cache.ttlSeconds, fallback 300s). */
const DEFAULT_TTL_MS = (config.cache?.ttlSeconds || 300) * 1000;

/** Cleanup interval: 5 minutes in ms. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** @type {Map<string, { value: *, expiresAt: number }>} */
const store = new Map();

/**
 * Remove all expired entries from the cache store.
 */
function cleanupExpired() {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of store.entries()) {
    if (now >= entry.expiresAt) {
      store.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    log.debug(`Cache cleanup removed ${removed} expired entries`);
  }
}

// Periodic background cleanup
const cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Get a value from the cache.
 * @param {string} key
 * @returns {*|null} Cached value or null if missing/expired
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Set a value in the cache with optional TTL (in ms).
 * @param {string} key
 * @param {*} value
 * @param {number} [ttlMs=DEFAULT_TTL_MS] - Time-to-live in milliseconds
 */
function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= MAX_SIZE) {
    // Evict oldest entry
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) {
      store.delete(oldestKey);
    }
  }

  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Check if a non-expired key exists in the cache.
 * @param {string} key
 * @returns {boolean}
 */
function has(key) {
  const entry = store.get(key);
  if (!entry) return false;

  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return false;
  }

  return true;
}

/**
 * Delete a key from the cache.
 * @param {string} key
 * @returns {boolean}
 */
function del(key) {
  return store.delete(key);
}

/**
 * Clear all entries from the cache.
 */
function clear() {
  store.clear();
}

/**
 * Generate a deterministic cache key from a prefix and parameter object.
 * @param {string} prefix
 * @param {Object} [params={}]
 * @returns {string}
 */
function makeKey(prefix, params = {}) {
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys
    .filter(k => params[k] !== undefined)
    .map(k => `${k}:${JSON.stringify(params[k])}`)
    .join('|');
  return `${prefix}::${serialized}`;
}

/**
 * Clean expired entries and return cache statistics.
 * @returns {{ size: number, maxSize: number }}
 */
function stats() {
  cleanupExpired();
  return {
    size: store.size,
    maxSize: MAX_SIZE,
  };
}

module.exports = {
  get,
  set,
  has,
  del,
  clear,
  makeKey,
  stats,
};

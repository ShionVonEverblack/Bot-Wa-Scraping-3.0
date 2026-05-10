'use strict';

/**
 * @fileoverview Per-user conversation memory with TTL auto-cleanup.
 * Stores last keyword, type, jobId, intent, and message history per userId.
 * @module bot/nlp/contextMemory
 */

const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('nlp:context');

/** Default TTL: 30 minutes in ms. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/** Cleanup interval: 5 minutes in ms. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** Max messages kept in history per user. */
const MAX_HISTORY = 20;

/**
 * @typedef {Object} UserContext
 * @property {string} userId
 * @property {string|null} lastKeyword
 * @property {string|null} lastType
 * @property {string|null} lastJobId
 * @property {string|null} lastIntent
 * @property {Array<{role:string, content:string, ts:number}>} messages
 * @property {number} updatedAt - Timestamp of last update
 */

/** In-memory store: userId → UserContext. */
const store = new Map();

/** Reference to the cleanup interval so it can be cleared. */
let cleanupTimer = null;

/**
 * Start the auto-cleanup timer.
 */
function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [userId, ctx] of store.entries()) {
      if (now - ctx.updatedAt > DEFAULT_TTL_MS) {
        store.delete(userId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      log.debug(`Cleaned ${cleaned} expired context entries`);
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't keep Node.js alive just for cleanup
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Stop the auto-cleanup timer.
 */
function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Store or update context for a user.
 * @param {string} userId - WhatsApp user ID (e.g., "628xxx@c.us")
 * @param {Object} update - Fields to update
 * @param {string} [update.lastKeyword] - Last search keyword
 * @param {string} [update.lastType] - Last search type
 * @param {string} [update.lastJobId] - Last job ID
 * @param {string} [update.lastIntent] - Last detected intent
 * @param {{role:string, content:string}} [update.message] - Message to add to history
 */
function storeContext(userId, update) {
  if (!userId) return;

  let ctx = store.get(userId);
  if (!ctx) {
    ctx = {
      userId,
      lastKeyword: null,
      lastType: null,
      lastJobId: null,
      lastIntent: null,
      messages: [],
      updatedAt: Date.now(),
    };
    store.set(userId, ctx);
  }

  // Update fields
  if (update.lastKeyword !== undefined) ctx.lastKeyword = update.lastKeyword;
  if (update.lastType !== undefined) ctx.lastType = update.lastType;
  if (update.lastJobId !== undefined) ctx.lastJobId = update.lastJobId;
  if (update.lastIntent !== undefined) ctx.lastIntent = update.lastIntent;

  // Add message to history
  if (update.message) {
    ctx.messages.push({
      role: update.message.role || 'user',
      content: update.message.content || '',
      ts: Date.now(),
    });
    // Trim history
    if (ctx.messages.length > MAX_HISTORY) {
      ctx.messages = ctx.messages.slice(-MAX_HISTORY);
    }
  }

  ctx.updatedAt = Date.now();

  // Ensure cleanup is running
  startCleanup();
}

/**
 * Get context for a user.
 * @param {string} userId - WhatsApp user ID
 * @returns {UserContext|null} Context or null if not found/expired
 */
function getContext(userId) {
  if (!userId) return null;
  const ctx = store.get(userId);
  if (!ctx) return null;

  // Check TTL
  if (Date.now() - ctx.updatedAt > DEFAULT_TTL_MS) {
    store.delete(userId);
    return null;
  }

  return ctx;
}

/**
 * Clear context for a user.
 * @param {string} userId - WhatsApp user ID
 */
function clearContext(userId) {
  if (!userId) return;
  store.delete(userId);
  log.debug(`Context cleared for ${userId}`);
}

/**
 * Get the number of active context entries (for monitoring).
 * @returns {number}
 */
function size() {
  return store.size;
}

module.exports = {
  store: storeContext,
  get: getContext,
  clear: clearContext,
  size,
  startCleanup,
  stopCleanup,
};

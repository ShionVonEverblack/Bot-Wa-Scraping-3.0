'use strict';

/**
 * @fileoverview Menu session store — tracks interactive menu state per user.
 * @module bot/menu/menuSessionStore
 */

/** @type {Map<string, { page: string, data: Object, timestamp: number }>} */
const sessions = new Map();

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Set menu session.
 * @param {string} userId
 * @param {string} page - Current menu page
 * @param {Object} [data={}] - Additional state
 */
function set(userId, page, data = {}) {
  sessions.set(userId, { page, data, timestamp: Date.now() });
}

/**
 * Get menu session.
 * @param {string} userId
 * @returns {{ page: string, data: Object }|null}
 */
function get(userId) {
  const session = sessions.get(userId);
  if (!session) return null;
  if (Date.now() - session.timestamp > TIMEOUT_MS) {
    sessions.delete(userId);
    return null;
  }
  return { page: session.page, data: session.data };
}

/**
 * Check if user has an active menu session.
 * @param {string} userId
 * @returns {boolean}
 */
function isActive(userId) {
  return get(userId) !== null;
}

/**
 * Clear a menu session.
 * @param {string} userId
 */
function clear(userId) {
  sessions.delete(userId);
}

module.exports = { set, get, isActive, clear };

'use strict';

/**
 * @fileoverview Security service — formal rate limiter, access control, mention guard.
 * @module services/security/index
 */

const config = require('../../config');
const { normalizePhone, extractPhone, isAdmin } = require('../identity');
const { createLogger } = require('../monitor/logger');

const log = createLogger('security');

/** Rate limiter: userId → { count, windowStart } */
const rateLimiter = new Map();
const RATE_WINDOW_MS = 60000; // 1 minute window
const RATE_LIMIT = 30; // Max messages per window

/**
 * Check rate limit for a user.
 * @param {string} userId
 * @returns {{ allowed: boolean, remaining: number }}
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimiter.get(userId);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimiter.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    log.warn(`Rate limited: ${userId} (${entry.count} msgs in window)`);
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

/**
 * Check if a user has access (allowlist/denylist).
 * @param {string} userId
 * @returns {{ allowed: boolean, reason: string }}
 */
function checkAccess(userId) {
  const phone = extractPhone(userId);
  const { allowList, denyList, adminPhones } = config.group;

  // Admins always allowed
  if (isAdmin(userId)) {
    return { allowed: true, reason: 'admin' };
  }

  // Denylist
  if (denyList.length > 0) {
    for (const denied of denyList) {
      if (phone.includes(normalizePhone(denied))) {
        return { allowed: false, reason: 'denylist' };
      }
    }
  }

  // Allowlist
  if (allowList.length > 0) {
    const found = allowList.some(a => phone.includes(normalizePhone(a)));
    if (!found) {
      return { allowed: false, reason: 'not_in_allowlist' };
    }
  }

  return { allowed: true, reason: 'ok' };
}

/**
 * Sanitize user input — strip dangerous characters.
 * @param {string} input
 * @returns {string}
 */
function sanitizeInput(input) {
  if (!input) return '';
  // Remove null bytes, control characters
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// Cleanup rate limiter every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimiter) {
    if (now - entry.windowStart > RATE_WINDOW_MS * 2) {
      rateLimiter.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

module.exports = { checkRateLimit, checkAccess, sanitizeInput };

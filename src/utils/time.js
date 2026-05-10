'use strict';

/**
 * @fileoverview Time and date utility helpers.
 * @module utils/time
 */

/**
 * Get current timestamp in ISO 8601 format.
 * @returns {string} ISO date string
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Format a duration in milliseconds to human-readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} e.g. "2m 15s", "350ms", "1h 5m"
 */
function formatDuration(ms) {
  if (ms < 0) ms = 0;
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainMin = minutes % 60;
    return remainMin > 0 ? `${hours}h ${remainMin}m` : `${hours}h`;
  }
  if (minutes > 0) {
    const remainSec = seconds % 60;
    return remainSec > 0 ? `${minutes}m ${remainSec}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Parse a time string (e.g., "30s", "5m", "1h", "daily", "weekly") to milliseconds.
 * @param {string} input - Time string
 * @returns {number|null} Milliseconds, or null if unparseable
 */
function parseTime(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim().toLowerCase();

  // Named intervals
  if (str === 'daily') return 24 * 60 * 60 * 1000;
  if (str === 'weekly') return 7 * 24 * 60 * 60 * 1000;
  if (str === 'hourly') return 60 * 60 * 1000;

  // Pattern: number + unit
  const match = str.match(/^(\d+)\s*(ms|s|m|h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 1);
}

module.exports = { nowIso, formatDuration, parseTime };

'use strict';

/**
 * @fileoverview Job ID generator.
 * @module utils/id
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a unique job ID in format: J + 5 random alphanumeric chars.
 * Example: "JaB3xZ"
 * @returns {string} Job ID
 */
function generateJobId() {
  let id = 'J';
  for (let i = 0; i < 5; i++) {
    id += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return id;
}

module.exports = { generateJobId };

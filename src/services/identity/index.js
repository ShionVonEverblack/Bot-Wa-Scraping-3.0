'use strict';

/**
 * @fileoverview Identity service — phone number normalization and user identification.
 * @module services/identity/index
 */

const config = require('../../config');
const { createLogger } = require('../monitor/logger');

const log = createLogger('identity');

/**
 * Normalize a phone number to standard format.
 * @param {string} phone - Raw phone number
 * @returns {string} Normalized phone
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');

  // Indonesian: 08xx → 628xx
  if (cleaned.startsWith('08')) {
    cleaned = '62' + cleaned.slice(1);
  }

  // Remove leading +
  cleaned = cleaned.replace(/^\+/, '');

  return cleaned;
}

/**
 * Extract phone number from WhatsApp serialized ID.
 * @param {string} serializedId - e.g. '628123456789@c.us'
 * @returns {string} Phone number
 */
function extractPhone(serializedId) {
  if (!serializedId) return '';
  return serializedId.split('@')[0];
}

/**
 * Check if a user is an admin.
 * @param {string} userId - Serialized user ID
 * @returns {boolean}
 */
function isAdmin(userId) {
  const phone = extractPhone(userId);
  const adminPhones = config.group.adminPhones || [];
  return adminPhones.some(admin => phone.includes(normalizePhone(admin)));
}

/**
 * Get a display-safe identifier (masked phone).
 * @param {string} userId
 * @returns {string} e.g. '6281****789'
 */
function maskPhone(userId) {
  const phone = extractPhone(userId);
  if (phone.length < 6) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

module.exports = { normalizePhone, extractPhone, isAdmin, maskPhone };

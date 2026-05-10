'use strict';

/**
 * @fileoverview Wizard validators — validate input for each wizard step.
 * @module bot/wizard/wizardValidators
 */

const { normalizeType } = require('../../utils/validators');

/**
 * Validate keyword input.
 * @param {string} input
 * @returns {{ valid: boolean, value: string }}
 */
function validateKeyword(input) {
  const trimmed = (input || '').trim();
  if (!trimmed || trimmed.length < 2) return { valid: false, value: '' };
  return { valid: true, value: trimmed };
}

/**
 * Validate type selection.
 * @param {string} input
 * @returns {{ valid: boolean, value: string }}
 */
function validateType(input) {
  const trimmed = (input || '').trim().toLowerCase();
  const map = { '1': 'images', '2': 'papers', '3': 'datasets', '4': 'general' };
  const resolved = map[trimmed] || normalizeType(trimmed);

  const validTypes = ['images', 'papers', 'datasets', 'general'];
  if (validTypes.includes(resolved)) return { valid: true, value: resolved };
  return { valid: false, value: '' };
}

/**
 * Validate limit input.
 * @param {string} input
 * @returns {{ valid: boolean, value: number }}
 */
function validateLimit(input) {
  const trimmed = (input || '').trim().toLowerCase();
  if (trimmed === 'skip' || trimmed === '' || trimmed === '-') return { valid: true, value: 10 };

  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 1 || num > 50) return { valid: false, value: 10 };
  return { valid: true, value: num };
}

/**
 * Validate confirm input.
 * @param {string} input
 * @returns {{ valid: boolean, value: boolean }}
 */
function validateConfirm(input) {
  const trimmed = (input || '').trim().toLowerCase();
  const yes = ['ya', 'yes', 'y', 'ok', 'oke', 'lanjut', '1', 'yep', 'yap'];
  const no = ['tidak', 'no', 'n', 'batal', 'cancel', '0', 'nope'];

  if (yes.includes(trimmed)) return { valid: true, value: true };
  if (no.includes(trimmed)) return { valid: true, value: false };
  return { valid: false, value: false };
}

module.exports = { validateKeyword, validateType, validateLimit, validateConfirm };

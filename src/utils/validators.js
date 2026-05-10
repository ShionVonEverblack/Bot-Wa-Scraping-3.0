'use strict';

/**
 * @fileoverview Input validation and normalization utilities.
 * @module utils/validators
 */

const config = require('../config');

/** Map of type aliases → canonical type names. */
const TYPE_MAP = {
  image: 'images', images: 'images', gambar: 'images', foto: 'images', photo: 'images',
  paper: 'papers', papers: 'papers', jurnal: 'papers', journal: 'papers', artikel: 'papers', article: 'papers',
  dataset: 'datasets', datasets: 'datasets', data: 'datasets',
  general: 'general', web: 'general', website: 'general', umum: 'general',
};

/** Map of format aliases → canonical format names. */
const FORMAT_MAP = {
  json: 'json', jsonl: 'jsonl',
  csv: 'csv', tsv: 'tsv',
  excel: 'excel', xlsx: 'excel', xls: 'excel',
  html: 'html',
  txt: 'txt', text: 'txt',
  sql: 'sql',
};

/** Map of delivery aliases → canonical delivery names. */
const DELIVERY_MAP = {
  dm: 'dm', private: 'dm', pribadi: 'dm',
  here: 'here', group: 'here', grup: 'here', sini: 'here',
};

/**
 * Normalize a scrape type string to its canonical form.
 * @param {string} input - Raw type input (e.g., "gambar", "paper")
 * @returns {string} Canonical type ('images', 'papers', 'datasets', 'general')
 */
function normalizeType(input) {
  if (!input || typeof input !== 'string') return 'general';
  const key = input.trim().toLowerCase();
  return TYPE_MAP[key] || 'general';
}

/**
 * Normalize an output format string.
 * @param {string} input - Raw format input
 * @returns {string} Canonical format
 */
function normalizeFormat(input) {
  if (!input || typeof input !== 'string') return config.output.formatDefault;
  const key = input.trim().toLowerCase();
  return FORMAT_MAP[key] || config.output.formatDefault;
}

/**
 * Normalize a delivery mode string.
 * @param {string} input - Raw delivery input
 * @returns {string} 'dm' or 'here'
 */
function normalizeDelivery(input) {
  if (!input || typeof input !== 'string') return 'here';
  const key = input.trim().toLowerCase();
  return DELIVERY_MAP[key] || 'here';
}

/**
 * Parse and clamp a limit value within configured bounds.
 * @param {string|number} input - Raw limit value
 * @returns {number} Clamped limit
 */
function parseLimit(input) {
  const defaultLimit = config.limits.resultLimitDefault;
  const maxLimit = config.limits.resultLimitMax;

  if (input === undefined || input === null || input === '') return defaultLimit;
  const n = parseInt(String(input), 10);
  if (Number.isNaN(n) || n < 1) return defaultLimit;
  return Math.min(n, maxLimit);
}

module.exports = { normalizeType, normalizeFormat, normalizeDelivery, parseLimit };

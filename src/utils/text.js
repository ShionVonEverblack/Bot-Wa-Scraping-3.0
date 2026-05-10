'use strict';

/**
 * @fileoverview Text manipulation utilities.
 * @module utils/text
 */

const COMMAND_PREFIXES = ['!', '/'];

const WIZARD_TRIGGERS = [
  'hai', 'halo', 'hello', 'hi', 'hey', 'hei',
  'p', 'bot', 'oi', 'yo', 'assalamualaikum', 'selamat',
];

/**
 * Check if text starts with a command prefix (! or /).
 * @param {string} text - Input text
 * @returns {boolean}
 */
function startsWithCommand(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return COMMAND_PREFIXES.some(p => trimmed.startsWith(p));
}

/**
 * Split a command string into command name and argument tokens.
 * Example: "!scrape machine learning --limit 5" → { command: 'scrape', args: ['machine','learning','--limit','5'] }
 * @param {string} text - Full command text
 * @returns {{ command: string, args: string[], raw: string }}
 */
function splitArgs(text) {
  if (!text || typeof text !== 'string') return { command: '', args: [], raw: '' };
  const trimmed = text.trim();

  // Remove prefix
  let cleaned = trimmed;
  for (const p of COMMAND_PREFIXES) {
    if (cleaned.startsWith(p)) {
      cleaned = cleaned.slice(p.length);
      break;
    }
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  const command = (parts.shift() || '').toLowerCase();
  return { command, args: parts, raw: cleaned.slice(command.length).trim() };
}

/**
 * Check if text is a wizard/greeting trigger.
 * @param {string} text - Input text
 * @returns {boolean}
 */
function isWizardTrigger(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.trim().toLowerCase();
  // Exact match or starts-with for multi-word greetings
  return WIZARD_TRIGGERS.some(t => lower === t || lower.startsWith(t + ' '));
}

/**
 * Remove WhatsApp mention tags (@628xxx) from text.
 * @param {string} text - Input text
 * @returns {string} Text without mentions
 */
function stripMentions(text) {
  if (!text) return '';
  return text.replace(/@\d+/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text to a max length, appending ellipsis if truncated.
 * @param {string} text - Input text
 * @param {number} [maxLen=500] - Maximum character length
 * @returns {string}
 */
function truncate(text, maxLen = 500) {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

module.exports = { startsWithCommand, splitArgs, isWizardTrigger, stripMentions, truncate };

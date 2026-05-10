'use strict';

/**
 * @fileoverview AI safety module — system prompts, output filtering, secret redaction.
 * @module services/ai/safety/aiSafety
 */

const config = require('../../../config');

/**
 * Get the default system prompt for safe AI interactions.
 * @returns {string} System prompt text
 */
function getSystemPrompt() {
  return [
    `Kamu adalah ${config.botName}, asisten WhatsApp yang cerdas dan ramah.`,
    'Kamu membantu pengguna mencari informasi, data, paper, gambar, dan dataset.',
    'Jawab dengan sopan dalam bahasa yang sama dengan pengguna (Indonesia atau English).',
    '',
    'ATURAN:',
    '1. Jangan pernah mengungkapkan API keys, token, atau credentials.',
    '2. Jangan membuat konten yang berbahaya, ilegal, atau NSFW.',
    '3. Jangan berpura-pura menjadi orang lain.',
    '4. Jika tidak tahu jawaban, katakan dengan jujur.',
    '5. Berikan informasi yang akurat dan terverifikasi.',
    '6. Jangan memberikan saran medis, hukum, atau keuangan.',
  ].join('\n');
}

/** Patterns that indicate dangerous or inappropriate content. */
const DANGER_PATTERNS = [
  /cara\s+(membuat|bikin)\s+(bom|senjata|racun|narkoba|virus)/i,
  /how\s+to\s+(make|build|create)\s+(bomb|weapon|poison|drug)/i,
  /hack(ing)?\s+(bank|password|account)/i,
  /exploit\s+(children|minors)/i,
];

/**
 * Filter AI output text to remove potentially dangerous content.
 * @param {string} text - Raw AI output
 * @returns {string} Filtered text
 */
function filterOutput(text) {
  if (!text || typeof text !== 'string') return '';

  for (const pattern of DANGER_PATTERNS) {
    if (pattern.test(text)) {
      return 'Maaf, saya tidak dapat memberikan informasi tersebut.';
    }
  }

  return text;
}

/** Regex patterns for common API key formats. */
const SECRET_PATTERNS = [
  // OpenAI keys
  /sk-[a-zA-Z0-9_-]{20,}/g,
  // Gemini / Google API keys
  /AIza[a-zA-Z0-9_-]{30,}/g,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9_.-]{20,}/g,
  // Generic API key patterns
  /api[_-]?key[=:]\s*['"]?[a-zA-Z0-9_-]{16,}['"]?/gi,
  // GitHub tokens
  /gh[ps]_[a-zA-Z0-9]{30,}/g,
  // Generic long hex strings (potential secrets)
  /\b[a-f0-9]{32,}\b/gi,
];

/**
 * Redact any accidentally leaked API keys or secrets from text.
 * @param {string} text - Text that may contain secrets
 * @returns {string} Text with secrets replaced by [REDACTED]
 */
function redactSecrets(text) {
  if (!text || typeof text !== 'string') return '';

  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

module.exports = { getSystemPrompt, filterOutput, redactSecrets };

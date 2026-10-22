'use strict';

/**
 * @fileoverview Entity extractor — extracts keyword, type, limit, format, provider from text.
 * Supports both Indonesian and English.
 * @module bot/nlp/entityExtractor
 */

const { normalizeType, normalizeFormat, parseLimit } = require('../../utils/validators');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('nlp:entity');

/**
 * Type-indicating keywords mapped to canonical types.
 * @type {Object<string, string>}
 */
const TYPE_KEYWORDS = {
  // Indonesian
  gambar: 'images', foto: 'images', image: 'images', images: 'images',
  paper: 'papers', papers: 'papers', jurnal: 'papers', artikel: 'papers',
  dataset: 'datasets', datasets: 'datasets', data: 'datasets',
  // English synonyms
  photo: 'images', picture: 'images', pictures: 'images',
  journal: 'papers', article: 'papers', articles: 'papers', research: 'papers',
};

/**
 * Words to strip from keyword extraction (noise words).
 */
const NOISE_WORDS = new Set([
  'bot', 'scrape', 'cari', 'carikan', 'carian', 'find', 'search', 'tolong',
  'bantu', 'mau', 'nyari', 'tentang', 'about', 'dong', 'donk', 'ya', 'yah',
  'please', 'bisa', 'bro', 'sis', 'kak', 'min',
]);

/**
 * Extract type from text if a type keyword is present.
 * @param {string[]} words - Tokenized words
 * @returns {{ type: string|null, typeIndex: number }}
 */
function extractType(words) {
  for (let i = 0; i < words.length; i++) {
    const lower = words[i].toLowerCase();
    if (TYPE_KEYWORDS[lower]) {
      return { type: TYPE_KEYWORDS[lower], typeIndex: i };
    }
  }
  return { type: null, typeIndex: -1 };
}

/**
 * Extract limit from text (e.g., "limit 5", "5 hasil", "top 10").
 * @param {string} text - Raw text
 * @returns {{ limit: number|null, cleanText: string }}
 */
function extractLimit(text) {
  let limit = null;
  let cleanText = text;

  // Pattern: "limit N" or "limit=N"
  const limitMatch = text.match(/\blimit\s*[=:]?\s*(\d+)/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1], 10);
    cleanText = cleanText.replace(limitMatch[0], '').trim();
  }

  // Pattern: "top N" or "N hasil/results"
  if (!limit) {
    const topMatch = text.match(/\btop\s+(\d+)/i);
    if (topMatch) {
      limit = parseInt(topMatch[1], 10);
      cleanText = cleanText.replace(topMatch[0], '').trim();
    }
  }

  if (!limit) {
    const hasilMatch = text.match(/(\d+)\s+(hasil|results?|item)/i);
    if (hasilMatch) {
      limit = parseInt(hasilMatch[1], 10);
      cleanText = cleanText.replace(hasilMatch[0], '').trim();
    }
  }

  return { limit: limit ? parseLimit(limit) : null, cleanText };
}

/**
 * Extract format from text (e.g., "--format csv", "format excel").
 * @param {string} text - Raw text
 * @returns {{ format: string|null, cleanText: string }}
 */
function extractFormat(text) {
  let format = null;
  let cleanText = text;

  const formatMatch = text.match(/--?format\s+(\w+)/i);
  if (formatMatch) {
    format = normalizeFormat(formatMatch[1]);
    cleanText = cleanText.replace(formatMatch[0], '').trim();
  }

  return { format, cleanText };
}

/**
 * Extract DOI or arXiv identifier from text.
 * @param {string} text - Raw text
 * @returns {string|null} Identifier or null
 */
function extractIdentifier(text) {
  // DOI
  const doiMatch = text.match(/10\.\d{4,9}\/[^\s]+/);
  if (doiMatch) return doiMatch[0];

  // arXiv
  const arxivMatch = text.match(/(\d{4}\.\d{4,5}(v\d+)?)/);
  if (arxivMatch) return `arXiv:${arxivMatch[1]}`;

  // arXiv URL
  const arxivUrlMatch = text.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i);
  if (arxivUrlMatch) return `arXiv:${arxivUrlMatch[1]}`;

  // PMID
  const pmidMatch = text.match(/PMID[:\s]*(\d+)/i);
  if (pmidMatch) return `PMID:${pmidMatch[1]}`;

  return null;
}

/**
 * Extract entities from natural language text based on detected intent.
 * @param {string} text - User's message text
 * @param {string} intent - Detected intent (SCRAPE, PAPER_DOWNLOAD, etc.)
 * @returns {{ keyword: string, type: string, limit: number|null, format: string|null, provider: string|null, identifier: string|null }}
 */
function extractEntities(text, intent) {
  if (!text || typeof text !== 'string') {
    return { keyword: '', type: 'general', limit: null, format: null, provider: null, identifier: null };
  }

  // Extract identifier for paper downloads
  const identifier = extractIdentifier(text);

  // Extract limit
  let { limit, cleanText } = extractLimit(text);

  // Extract format
  const formatResult = extractFormat(cleanText);
  const format = formatResult.format;
  cleanText = formatResult.cleanText;

  // Extract AI flag
  const useAIMatch = cleanText.match(/(?:--|\+)ai\b/i);
  const useAI = !!useAIMatch;
  if (useAIMatch) {
    cleanText = cleanText.replace(useAIMatch[0], '').trim();
  }

  // Extract multi flag
  const multiMatch = cleanText.match(/(?:--|\+)multi\b/i);
  const multi = !!multiMatch;
  if (multiMatch) {
    cleanText = cleanText.replace(multiMatch[0], '').trim();
  }

  // Tokenize
  const words = cleanText.split(/\s+/).filter(Boolean);

  // Extract type
  const { type: detectedType, typeIndex } = extractType(words);
  const type = detectedType || 'general';

  // Build keyword: remove noise words and type keyword
  const keywordWords = words.filter((w, i) => {
    const lower = w.toLowerCase();
    if (i === typeIndex) return false;       // remove type word
    if (NOISE_WORDS.has(lower)) return false; // remove noise
    if (/^--?\w/.test(w)) return false;       // remove flags
    return true;
  });

  const keyword = keywordWords.join(' ').trim();

  log.debug('Entities extracted', { keyword, type, limit, format, identifier, useAI, multi });

  return { keyword, type, limit, format, provider: null, identifier, useAI, multi };
}

module.exports = { extractEntities, extractIdentifier };

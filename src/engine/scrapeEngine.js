'use strict';

/**
 * @fileoverview Scrape engine — orchestrates the full scraping pipeline.
 * route → fetch → normalize → dedupe → rank → format
 * @module engine/scrapeEngine
 */

const providerRouter = require('./providerRouter');
const cache = require('../services/cache');
const config = require('../config');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('engine:orchestrator');

/**
 * Full scrape pipeline orchestrator.
 * @param {Object} params
 * @param {string} params.type - images|papers|datasets|general
 * @param {string} params.keyword - Search keyword
 * @param {number} [params.limit=10]
 * @param {number} [params.page=1]
 * @param {string} [params.cursor]
 * @param {string} [params.provider] - Specific provider override
 * @param {boolean} [params.safeMode=true]
 * @param {boolean} [params.useCache=true]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ items: Array, meta: Object, providerUsed: string }>}
 */
async function scrape(params) {
  const {
    type, keyword, limit = 10, page = 1, cursor,
    provider, safeMode = true, useCache = true, signal,
  } = params;

  // 1. Cache check
  if (useCache) {
    const cacheKey = cache.makeKey('scrape', { type, keyword, limit, page, provider });
    const cached = cache.get(cacheKey);
    if (cached) {
      log.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }
  }

  // 2. Route to provider(s) — circuit breaker is handled inside providerRouter
  const result = await providerRouter.route({
    type, provider, keyword, limit, page, cursor, safeMode, signal,
  });

  // 4. Normalize items
  result.items = normalizeItems(result.items, type);

  // 5. Deduplicate
  result.items = deduplicateItems(result.items);

  // 6. Rank by relevance
  result.items = rankItems(result.items, keyword);

  // 7. Limit final results
  result.items = result.items.slice(0, limit);

  // 6. Cache result
  if (useCache && result.items.length > 0) {
    const cacheKey = cache.makeKey('scrape', { type, keyword, limit, page, provider });
    cache.set(cacheKey, result);
  }

  log.info(`Scrape pipeline completed: ${result.items.length} items (${result.providerUsed})`);
  return result;
}

/**
 * Normalize items — ensure consistent field names and types.
 * @param {Object[]} items
 * @param {string} type
 * @returns {Object[]}
 */
function normalizeItems(items, type) {
  return items.map(item => {
    const normalized = {
      title: String(item.title || 'Untitled').trim(),
      url: String(item.url || '').trim(),
      description: String(item.description || '').trim().slice(0, 500),
      source: String(item.source || 'unknown'),
      sourceUrl: String(item.sourceUrl || item.url || ''),
    };

    // Type-specific fields
    switch (type) {
      case 'images':
        normalized.thumbnail = item.thumbnail || item.url || '';
        normalized.width = parseInt(item.width, 10) || 0;
        normalized.height = parseInt(item.height, 10) || 0;
        normalized.photographer = item.photographer || item.author || '';
        break;

      case 'papers':
        normalized.authors = String(item.authors || '');
        normalized.year = parseInt(item.year, 10) || null;
        normalized.doi = item.doi || null;
        normalized.citationCount = parseInt(item.citationCount, 10) || 0;
        normalized.pdfUrl = item.pdfUrl || null;
        normalized.isOpenAccess = !!item.isOpenAccess;
        break;

      case 'datasets':
        normalized.author = item.author || '';
        normalized.downloads = parseInt(item.downloads || item.downloadCount, 10) || 0;
        normalized.size = item.size || '';
        normalized.license = item.license || '';
        break;

      default:
        // Keep extra fields as-is for general type
        Object.assign(normalized, {
          type: item.type || 'result',
          thumbnail: item.thumbnail || '',
        });
    }

    return normalized;
  });
}

/**
 * Deduplicate items by URL similarity.
 * @param {Object[]} items
 * @returns {Object[]}
 */
function deduplicateItems(items) {
  const seen = new Set();
  return items.filter(item => {
    // Normalize URL for comparison
    const key = item.url
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/+$/, '')
      .toLowerCase();

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Rank items by keyword relevance (simple scoring).
 * @param {Object[]} items
 * @param {string} keyword
 * @returns {Object[]}
 */
function rankItems(items, keyword) {
  const terms = keyword.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) return items;

  return items
    .map(item => {
      let score = 0;
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();

      for (const term of terms) {
        if (title.includes(term)) score += 3;
        if (desc.includes(term)) score += 1;
      }

      // Boost items with more metadata
      if (item.citationCount > 0) score += Math.min(item.citationCount / 100, 2);
      if (item.isOpenAccess) score += 1;
      if (item.pdfUrl) score += 0.5;

      return { ...item, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...item }) => item); // Remove score from output
}

module.exports = { scrape, normalizeItems, deduplicateItems, rankItems };

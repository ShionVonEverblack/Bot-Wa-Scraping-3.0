'use strict';

/**
 * @fileoverview LLM Web Reader & Firecrawl Provider for general scraping.
 * Converts direct URLs or web search queries into LLM-ready Markdown items.
 * @module engine/providers/general/webreader
 */

const config = require('../../../config');
const httpClient = require('../../../utils/httpClient');
const { scrapeUrlToMarkdown } = require('../../llmCrawler');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:webreader');

module.exports = {
  id: 'webreader',
  type: 'general',
  priority: 82,
  requiredKeys: [],
  supportsPagination: { page: false, cursor: false },

  /**
   * Scrape a URL or Firecrawl search query into structured LLM-ready items.
   * @param {Object} params
   * @param {string} params.keyword
   * @param {number} [params.limit=10]
   * @param {AbortSignal} [params.signal]
   * @returns {Promise<{ items: Array, meta: Object }>}
   */
  async scrape({ keyword, limit = 10, signal }) {
    const trimmed = (keyword || '').trim();

    // 1. Direct URL mode -> scrape into LLM-ready Markdown
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const doc = await scrapeUrlToMarkdown(trimmed, { signal });
        return {
          items: [
            {
              title: doc.title || trimmed,
              url: doc.url || trimmed,
              description: (doc.fitMarkdown || doc.markdown || doc.description || '').slice(0, 500),
              markdown: doc.fitMarkdown || doc.markdown || '',
              wordCount: doc.wordCount,
              readingTimeMinutes: doc.readingTimeMinutes,
              source: `webreader:${doc.bridgeUsed || 'native'}`,
              sourceUrl: trimmed,
            },
          ],
          meta: {
            hasMore: false,
            bridgeUsed: doc.bridgeUsed || 'native',
          },
        };
      } catch (err) {
        log.warn(`WebReader direct URL scrape failed: ${trimmed}`, { error: err.message });
        return { items: [], meta: { hasMore: false, error: err.message } };
      }
    }

    // 2. Search mode via Firecrawl Search API if FIRECRAWL_API_KEY is configured
    if (config.crawler?.firecrawlApiKey) {
      try {
        const resp = await httpClient.post(
          `${config.crawler.firecrawlBaseUrl}/search`,
          { query: trimmed, limit },
          {
            headers: { Authorization: `Bearer ${config.crawler.firecrawlApiKey}` },
            timeout: 20000,
            signal,
          }
        );

        const data = resp.data?.data || [];
        const items = data.slice(0, limit).map(entry => ({
          title: entry.title || entry.url || 'Untitled',
          url: entry.url || '',
          description: (entry.markdown || entry.description || '').slice(0, 500),
          markdown: entry.markdown || '',
          source: 'firecrawl',
          sourceUrl: entry.url || '',
        }));

        return {
          items,
          meta: { hasMore: false, provider: 'firecrawl' },
        };
      } catch (err) {
        log.debug('Firecrawl search API failed, delegating to fallback providers', { error: err.message });
      }
    }

    // Return empty so providerRouter falls through to Wikipedia / DuckDuckGo for non-URL keywords
    return { items: [], meta: { hasMore: false } };
  },
};

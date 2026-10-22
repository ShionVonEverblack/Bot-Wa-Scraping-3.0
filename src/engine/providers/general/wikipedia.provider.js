'use strict';

/**
 * @fileoverview Wikipedia search provider.
 * @module engine/providers/general/wikipedia
 */

const { get } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:wikipedia');

module.exports = {
  id: 'wikipedia',
  type: 'general',
  priority: 65,
  requiredKeys: [],
  supportsPagination: { page: false, cursor: true },

  /**
   * Scrape search results from Wikipedia API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {string} [params.cursor] - Offset for pagination
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, cursor, signal }) {
    try {
      const lang = config.providers.wikipediaLang || 'en';
      const srlimit = Math.min(limit, 50);
      const sroffset = cursor ? parseInt(cursor, 10) : 0;

      const response = await get(`https://${lang}.wikipedia.org/w/api.php`, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: keyword,
          srlimit,
          sroffset,
          srprop: 'snippet|titlesnippet|sectionsnippet|size|wordcount|timestamp',
          format: 'json',
          origin: '*',
        },
        signal,
      });

      const data = response.data;
      const search = data.query?.search || [];

      const items = search.map(result => ({
        title: result.title || '',
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
        description: (result.snippet || '').replace(/<[^>]+>/g, '').slice(0, 500),
        source: 'wikipedia',
        sourceUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
        wordCount: result.wordcount || 0,
        size: result.size || 0,
        lastUpdated: result.timestamp || null,
      }));

      const totalHits = data.query?.searchinfo?.totalhits || 0;
      const nextOffset = sroffset + items.length;

      log.debug(`Wikipedia: found ${items.length} results for "${keyword}"`);

      return {
        items,
        meta: {
          hasMore: nextOffset < totalHits,
          nextCursor: nextOffset < totalHits ? String(nextOffset) : null,
          total: totalHits,
          message: `Wikipedia (${lang}): ${totalHits} results`,
        },
      };
    } catch (err) {
      log.error('Wikipedia scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

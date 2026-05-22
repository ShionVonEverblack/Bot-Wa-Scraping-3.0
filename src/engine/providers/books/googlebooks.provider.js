'use strict';

/**
 * @fileoverview Google Books API provider for searching literature and books.
 * @module engine/providers/books/googlebooks
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:googlebooks');

module.exports = {
  id: 'googlebooks',
  type: 'books',
  priority: 90,
  requiredKeys: [], // Google Books API basic search doesn't require an API key
  supportsPagination: { page: true, cursor: false }, // uses startIndex

  /**
   * Scrape results from Google Books API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {boolean} [params.safeMode=true] - Safe search
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @param {number} [params.page=1] - Pagination page
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, safeMode = true, signal, page = 1 }) {
    try {
      const startIndex = (page - 1) * limit;
      const response = await get('https://www.googleapis.com/books/v1/volumes', {
        params: {
          q: keyword,
          maxResults: Math.min(limit, 40), // Google Books API limit is 40
          startIndex,
          printType: 'books', // Only books, not magazines
        },
        signal,
      });

      const data = response.data;
      if (!data || !data.items || data.items.length === 0) {
        return { items: [], meta: { hasMore: false } };
      }

      const items = data.items.map(item => {
        const vol = item.volumeInfo || {};
        return {
          title: vol.title || 'Untitled',
          url: vol.infoLink || '',
          description: vol.description ? vol.description.slice(0, 300) + (vol.description.length > 300 ? '...' : '') : '',
          source: 'googlebooks',
          sourceUrl: 'https://books.google.com/',
          type: 'book',
          authors: vol.authors ? vol.authors.join(', ') : 'Unknown',
          publishedDate: vol.publishedDate || 'Unknown',
          publisher: vol.publisher || 'Unknown',
          pageCount: vol.pageCount || 0,
          isbn: vol.industryIdentifiers ? vol.industryIdentifiers.map(i => i.identifier).join(', ') : '',
          thumbnail: vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail || '',
        };
      });

      log.debug(`GoogleBooks: found ${items.length} results for "${keyword}"`);

      // Determine if there are more results
      const totalItems = data.totalItems || 0;
      const hasMore = startIndex + items.length < totalItems;

      return {
        items: items.slice(0, limit),
        meta: {
          hasMore,
          totalItems,
          message: `GoogleBooks: ${items.length} books`,
        },
      };
    } catch (err) {
      log.error('GoogleBooks scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

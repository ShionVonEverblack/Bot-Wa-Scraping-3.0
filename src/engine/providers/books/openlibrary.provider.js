'use strict';

/**
 * @fileoverview Open Library (Internet Archive) book search provider.
 * Catalog of millions of books with authors, ISBNs, publication history, and covers.
 * @module engine/providers/books/openlibrary
 */

const httpClient = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:openlibrary');

module.exports = {
  id: 'openlibrary',
  type: 'books',
  priority: 88,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Search books in Open Library.
   * @param {Object} params
   * @param {string} params.keyword - Search query
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const perPage = Math.min(limit, 30);
      const response = await httpClient.get('https://openlibrary.org/search.json', {
        params: {
          q: keyword,
          limit: perPage,
          page,
        },
        signal,
        timeout: 15000,
      });

      const data = response.data || {};
      const docs = data.docs || [];
      const total = data.numFound || 0;

      const items = docs.map(doc => {
        const authors = Array.isArray(doc.author_name)
          ? doc.author_name.join(', ')
          : 'Unknown Author';

        const coverUrl = doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null;

        const isbn = Array.isArray(doc.isbn) ? doc.isbn[0] : null;
        const key = doc.key || '';
        const url = key.startsWith('http') ? key : `https://openlibrary.org${key}`;

        return {
          title: doc.title || 'Untitled Book',
          url,
          description: `Author: ${authors}. First Published: ${doc.first_publish_year || 'Unknown'}.${isbn ? ` ISBN: ${isbn}` : ''} Languages: ${(doc.language || []).slice(0, 3).join(', ')}`,
          source: 'openlibrary',
          sourceUrl: url,
          authors,
          year: doc.first_publish_year || null,
          isbn,
          coverUrl,
          publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : null,
          isOpenAccess: Boolean(doc.has_fulltext),
        };
      });

      return {
        items,
        meta: {
          page,
          hasMore: page * perPage < total,
          total,
          message: `Open Library: found ${items.length} books for "${keyword}"`,
        },
      };
    } catch (err) {
      log.error('Open Library search failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

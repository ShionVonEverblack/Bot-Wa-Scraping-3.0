'use strict';

/**
 * @fileoverview Gutendex (Project Gutenberg) free public-domain e-books provider.
 * Access to 70,000+ classic books with direct download links (TXT, EPUB, HTML).
 * @module engine/providers/books/gutendex
 */

const httpClient = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:gutendex');

module.exports = {
  id: 'gutendex',
  type: 'books',
  priority: 85,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Search free public-domain books on Project Gutenberg.
   * @param {Object} params
   * @param {string} params.keyword - Search query
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const response = await httpClient.get('https://gutendex.com/books', {
        params: {
          search: keyword,
          page,
        },
        signal,
        timeout: 15000,
      });

      const data = response.data || {};
      const results = (data.results || []).slice(0, limit);
      const total = data.count || 0;

      const items = results.map(book => {
        const authors = Array.isArray(book.authors)
          ? book.authors.map(a => a.name).join(', ')
          : 'Public Domain Author';

        const formats = book.formats || {};
        const textUrl =
          formats['text/plain; charset=utf-8'] ||
          formats['text/plain; charset=us-ascii'] ||
          formats['text/plain'] ||
          null;
        const epubUrl = formats['application/epub+zip'] || null;
        const htmlUrl = formats['text/html'] || `https://www.gutenberg.org/ebooks/${book.id}`;
        const coverUrl = formats['image/jpeg'] || null;

        return {
          title: book.title || 'Untitled Book',
          url: htmlUrl,
          description: `Author: ${authors}. Downloads: ${book.download_count || 0}. Languages: ${(book.languages || []).join(', ')}. Subjects: ${(book.subjects || []).slice(0, 3).join('; ')}`,
          source: 'gutendex',
          sourceUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
          authors,
          downloads: book.download_count || 0,
          downloadUrl: textUrl || epubUrl || htmlUrl,
          textUrl,
          epubUrl,
          coverUrl,
          gutenbergId: book.id,
          isOpenAccess: true,
        };
      });

      return {
        items,
        meta: {
          page,
          hasMore: Boolean(data.next),
          total,
          message: `Project Gutenberg: found ${items.length} books for "${keyword}"`,
        },
      };
    } catch (err) {
      log.error('Gutendex search failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

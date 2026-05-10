'use strict';

/**
 * @fileoverview Crossref paper provider (free, polite pool with email).
 * @module engine/providers/papers/crossref
 */

const { get } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:crossref');

module.exports = {
  id: 'crossref',
  type: 'papers',
  priority: 80,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: true },

  /**
   * Scrape papers from Crossref API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {string} [params.cursor] - Cursor for deep pagination
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, cursor, signal }) {
    try {
      const rows = Math.min(limit, 100);
      const params = {
        query: keyword,
        rows,
        sort: 'relevance',
        order: 'desc',
      };

      // Polite pool
      const email = config.providers.crossrefMailto || config.providers.contactEmail;
      if (email) {
        params.mailto = email;
      }

      if (cursor && cursor !== '*') {
        params.cursor = cursor;
      } else {
        params.offset = (page - 1) * rows;
      }

      const response = await get('https://api.crossref.org/works', {
        params,
        signal,
        timeout: 30000,
      });

      const data = response.data;
      const message = data.message || {};
      const rawItems = message.items || [];

      const items = rawItems.map(work => {
        const title = Array.isArray(work.title) ? work.title[0] : (work.title || 'Untitled');
        const authors = (work.author || [])
          .map(a => [a.given, a.family].filter(Boolean).join(' '))
          .join(', ');

        const published = work['published-print']?.['date-parts']?.[0]
          || work['published-online']?.['date-parts']?.[0]
          || work.created?.['date-parts']?.[0];

        return {
          title,
          url: work.URL || (work.DOI ? `https://doi.org/${work.DOI}` : ''),
          description: work.abstract
            ? work.abstract.replace(/<[^>]+>/g, '').slice(0, 500)
            : '',
          authors,
          year: published ? published[0] : null,
          doi: work.DOI || null,
          citationCount: work['is-referenced-by-count'] || 0,
          source: 'crossref',
          sourceUrl: work.URL || '',
          venue: work['container-title']
            ? (Array.isArray(work['container-title']) ? work['container-title'][0] : work['container-title'])
            : '',
          type: work.type || 'journal-article',
          isOpenAccess: false,
          publisher: work.publisher || '',
        };
      });

      const nextCursor = message['next-cursor'] || null;
      const total = message['total-results'] || 0;

      log.debug(`Crossref: found ${items.length} papers for "${keyword}"`);

      return {
        items,
        meta: {
          page,
          hasMore: !!nextCursor || ((page - 1) * rows + items.length < total),
          nextCursor,
          total,
          message: `Crossref: ${total} total results`,
        },
      };
    } catch (err) {
      log.error('Crossref scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

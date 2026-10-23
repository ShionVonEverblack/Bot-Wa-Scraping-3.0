'use strict';

/**
 * @fileoverview DBLP Computer Science bibliography provider.
 * Free programmatic access to 7M+ computer science, AI, and software publications.
 * @module engine/providers/papers/dblp
 */

const httpClient = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:dblp');

module.exports = {
  id: 'dblp',
  type: 'papers',
  priority: 78,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape computer science publications from DBLP.
   * @param {Object} params
   * @param {string} params.keyword - Search query
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const h = Math.min(limit, 50);
      const f = (page - 1) * h;

      const response = await httpClient.get('https://dblp.org/search/publ/api', {
        params: {
          q: keyword,
          format: 'json',
          h,
          f,
        },
        signal,
        timeout: 15000,
      });

      const result = response.data?.result || {};
      const hits = result.hits?.hit || [];
      const total = parseInt(result.hits?.['@total'] || '0', 10);

      const items = (Array.isArray(hits) ? hits : [hits]).map(hit => {
        const info = hit.info || {};

        // Parse authors safely
        let authors = '';
        if (info.authors?.author) {
          const authList = Array.isArray(info.authors.author)
            ? info.authors.author
            : [info.authors.author];
          authors = authList
            .map(a => (typeof a === 'string' ? a : a.text || ''))
            .filter(Boolean)
            .join(', ');
        }

        const title = (info.title || 'Untitled Publication').replace(/\.+$/, '');
        const venue = info.venue || info.series || 'Computer Science Conference/Journal';
        const year = info.year ? parseInt(info.year, 10) : null;
        const doi = info.doi || null;
        const ee = info.ee || '';
        const pdfUrl = typeof ee === 'string' && ee.endsWith('.pdf') ? ee : null;

        return {
          title,
          url: ee || info.url || `https://dblp.org/rec/${hit['@id'] || ''}`,
          description: `Venue: ${venue}. Type: ${info.type || 'Publication'} (${year || 'N/A'}). DBLP ID: ${hit['@id'] || ''}`,
          authors,
          year,
          doi,
          source: 'dblp',
          sourceUrl: info.url || `https://dblp.org/rec/${hit['@id'] || ''}`,
          pdfUrl,
          isOpenAccess: Boolean(pdfUrl || (typeof ee === 'string' && ee.includes('arxiv.org'))),
        };
      });

      return {
        items,
        meta: {
          page,
          hasMore: f + items.length < total,
          total,
          message: `DBLP: found ${items.length} computer science publications`,
        },
      };
    } catch (err) {
      log.error('DBLP scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

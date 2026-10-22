'use strict';

/**
 * @fileoverview OpenAlex paper provider (free, no API key required).
 * @module engine/providers/papers/openalex
 */

const { get } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:openalex');

module.exports = {
  id: 'openalex',
  type: 'papers',
  priority: 90,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: true },

  /**
   * Scrape papers from OpenAlex API.
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
      const perPage = Math.min(limit, 200);
      const params = {
        search: keyword,
        per_page: perPage,
        sort: 'relevance_score:desc',
      };

      // Use cursor pagination if available, otherwise page
      if (cursor && cursor !== '*') {
        params.cursor = cursor;
      } else {
        params.page = page;
      }

      // Polite pool: include email
      const email = config.providers.openalexEmail || config.providers.contactEmail;
      if (email) {
        params.mailto = email;
      }

      const response = await get('https://api.openalex.org/works', {
        params,
        signal,
      });

      const data = response.data;
      const items = (data.results || []).map(work => ({
        title: work.title || 'Untitled',
        url: work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : work.id || '',
        description: work.abstract_inverted_index
          ? reconstructAbstract(work.abstract_inverted_index)
          : '',
        authors: (work.authorships || []).map(a => a.author?.display_name).filter(Boolean).join(', '),
        year: work.publication_year,
        doi: work.doi ? work.doi.replace('https://doi.org/', '') : null,
        citationCount: work.cited_by_count || 0,
        source: 'openalex',
        sourceUrl: work.id || '',
        openAccessUrl: work.open_access?.oa_url || null,
        pdfUrl: work.primary_location?.pdf_url || work.open_access?.oa_url || null,
        venue: work.primary_location?.source?.display_name || '',
        type: work.type || 'article',
        isOpenAccess: work.open_access?.is_oa || false,
      }));

      const nextCursor = data.meta?.next_cursor || null;
      const totalCount = data.meta?.count || 0;

      log.debug(`OpenAlex: found ${items.length} papers for "${keyword}"`);

      return {
        items,
        meta: {
          page,
          hasMore: !!nextCursor || (page * perPage < totalCount),
          nextCursor,
          total: totalCount,
          message: `OpenAlex: ${totalCount} total results`,
        },
      };
    } catch (err) {
      log.error('OpenAlex scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

/**
 * Reconstruct abstract from OpenAlex's inverted index format.
 * @param {Object} invertedIndex - { word: [positions] }
 * @returns {string} Reconstructed abstract text
 */
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';

  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(' ').slice(0, 500);
}

'use strict';

/**
 * @fileoverview Semantic Scholar paper provider.
 * @module engine/providers/papers/semanticscholar
 */

const { get } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:s2');

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';

module.exports = {
  id: 'semanticscholar',
  type: 'papers',
  priority: 75,
  requiredKeys: [],
  supportsPagination: { page: false, cursor: true },

  /**
   * Scrape papers from Semantic Scholar API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {string} [params.cursor] - Offset token
   * @param {number} [params.page=1] - Fallback page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, cursor, signal }) {
    try {
      const queryLimit = Math.min(limit, 100);
      const offset = cursor ? parseInt(cursor, 10) : (page - 1) * queryLimit;

      const headers = {};
      const apiKey = config.providers.s2ApiKey;
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const fields = 'title,url,abstract,authors,year,citationCount,openAccessPdf,externalIds,venue,publicationTypes,isOpenAccess';

      const response = await get(`${BASE_URL}/paper/search`, {
        params: {
          query: keyword,
          limit: queryLimit,
          offset,
          fields,
        },
        headers,
        signal,
        timeout: 30000,
      });

      const data = response.data;
      const items = (data.data || []).map(paper => ({
        title: paper.title || 'Untitled',
        url: paper.url || '',
        description: paper.abstract ? paper.abstract.slice(0, 500) : '',
        authors: (paper.authors || []).map(a => a.name).filter(Boolean).join(', '),
        year: paper.year,
        doi: paper.externalIds?.DOI || null,
        arxivId: paper.externalIds?.ArXiv || null,
        citationCount: paper.citationCount || 0,
        source: 'semanticscholar',
        sourceUrl: paper.url || '',
        pdfUrl: paper.openAccessPdf?.url || null,
        venue: paper.venue || '',
        type: paper.publicationTypes ? paper.publicationTypes[0] : 'article',
        isOpenAccess: paper.isOpenAccess || false,
      }));

      const total = data.total || 0;
      const nextOffset = offset + items.length;

      log.debug(`Semantic Scholar: found ${items.length} papers for "${keyword}"`);

      return {
        items,
        meta: {
          page,
          hasMore: nextOffset < total,
          nextCursor: nextOffset < total ? String(nextOffset) : null,
          total,
          message: `Semantic Scholar: ${total} total results`,
        },
      };
    } catch (err) {
      log.error('Semantic Scholar scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

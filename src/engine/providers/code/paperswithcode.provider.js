'use strict';

/**
 * @fileoverview Papers With Code ML research & code provider.
 * Connects machine learning research papers directly with their GitHub code implementations.
 * @module engine/providers/code/paperswithcode
 */

const httpClient = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:paperswithcode');

module.exports = {
  id: 'paperswithcode',
  type: 'code',
  priority: 90,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Search papers with associated code implementations.
   * @param {Object} params
   * @param {string} params.keyword - Search query
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const perPage = Math.min(limit, 25);
      const response = await httpClient.get('https://paperswithcode.com/api/v1/papers/', {
        params: {
          q: keyword,
          items_per_page: perPage,
          page,
        },
        signal,
        timeout: 15000,
      });

      const data = response.data || {};
      const results = data.results || [];
      const total = data.count || 0;

      const items = results.map(paper => {
        const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : '';
        const arxivId = paper.arxiv_id || '';
        const pwcUrl = paper.id ? `https://paperswithcode.com/paper/${paper.id}` : '';
        const paperUrl = paper.url_abs || (arxivId ? `https://arxiv.org/abs/${arxivId}` : pwcUrl);
        const pdfUrl = paper.url_pdf || (arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : null);

        return {
          title: paper.title || 'Untitled ML Paper',
          url: pwcUrl || paperUrl,
          description: (paper.abstract || 'No abstract provided.').slice(0, 300),
          source: 'paperswithcode',
          sourceUrl: pwcUrl,
          authors,
          year: paper.published ? new Date(paper.published).getFullYear() : null,
          arxivId,
          paperUrl,
          pdfUrl,
          stars: 0,
          language: 'Python',
          isOpenAccess: true,
        };
      });

      return {
        items,
        meta: {
          page,
          hasMore: page * perPage < total,
          total,
          message: `PapersWithCode: found ${items.length} papers with implementations`,
        },
      };
    } catch (err) {
      log.error('PapersWithCode search failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

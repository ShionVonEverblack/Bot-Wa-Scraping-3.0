'use strict';

/**
 * @fileoverview Zenodo datasets provider (free, open-access scientific datasets).
 * @module engine/providers/datasets/zenodo
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:zenodo');

module.exports = {
  id: 'zenodo',
  type: 'datasets',
  priority: 85, // Higher priority for academic datasets
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape datasets from Zenodo API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Pagination
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const queryLimit = Math.min(limit, 100);
      
      const response = await get('https://zenodo.org/api/records', {
        params: {
          q: keyword,
          type: 'dataset',
          size: queryLimit,
          page: page,
          sort: 'mostrecent'
        },
        signal,
      });

      const hits = response.data?.hits?.hits || [];

      const items = hits.map(hit => {
        const metadata = hit.metadata || {};
        const creators = metadata.creators || [];
        const author = creators.length > 0 ? creators[0].name : 'Unknown';
        
        return {
          title: metadata.title || 'Untitled',
          url: hit.links?.html || `https://zenodo.org/record/${hit.id}`,
          description: (metadata.description || '').replace(/<[^>]+>/g, '').trim() || '',
          author: author,
          source: 'zenodo',
          sourceUrl: hit.links?.html || `https://zenodo.org/record/${hit.id}`,
          downloads: hit.stats?.downloads || 0,
          views: hit.stats?.views || 0,
          size: hit.stats?.volume || 0,
          license: metadata.license?.id || 'Unknown',
          date: metadata.publication_date || null,
        };
      });

      log.debug(`Zenodo: found ${items.length} datasets for "${keyword}"`);

      return {
        items,
        meta: {
          hasMore: items.length >= queryLimit,
          nextPage: items.length >= queryLimit ? page + 1 : null,
          message: `Zenodo: ${items.length} datasets found`,
        },
      };
    } catch (err) {
      log.error('Zenodo scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

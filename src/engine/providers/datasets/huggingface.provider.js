'use strict';

/**
 * @fileoverview HuggingFace datasets provider (free, no API key required).
 * @module engine/providers/datasets/huggingface
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:huggingface');

module.exports = {
  id: 'huggingface',
  type: 'datasets',
  priority: 80,
  requiredKeys: [],
  supportsPagination: { page: false, cursor: true },

  /**
   * Scrape datasets from HuggingFace API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, cursor, signal }) {
    try {
      const queryLimit = Math.min(limit, 100);
      const params = {
        search: keyword,
        limit: queryLimit,
        sort: 'downloads',
        direction: -1,
      };

      if (cursor) {
        params.offset = parseInt(cursor, 10) || 0;
      }

      const response = await get('https://huggingface.co/api/datasets', {
        params,
        signal,
      });

      const data = Array.isArray(response.data) ? response.data : [];

      const items = data.map(ds => ({
        title: ds.id || 'Untitled',
        url: `https://huggingface.co/datasets/${ds.id}`,
        description: ds.description || ds.cardData?.description || '',
        author: ds.author || ds.id?.split('/')[0] || 'Unknown',
        source: 'huggingface',
        sourceUrl: `https://huggingface.co/datasets/${ds.id}`,
        downloads: ds.downloads || 0,
        likes: ds.likes || 0,
        tags: ds.tags || [],
        lastModified: ds.lastModified || null,
        license: ds.cardData?.license || '',
        isPrivate: ds.private || false,
      }));

      const offset = cursor ? parseInt(cursor, 10) : 0;
      const nextOffset = offset + items.length;

      log.debug(`HuggingFace: found ${items.length} datasets for "${keyword}"`);

      return {
        items,
        meta: {
          hasMore: items.length >= queryLimit,
          nextCursor: items.length >= queryLimit ? String(nextOffset) : null,
          message: `HuggingFace: ${items.length} datasets found`,
        },
      };
    } catch (err) {
      log.error('HuggingFace scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

'use strict';

/**
 * @fileoverview Pixabay image provider.
 * @module engine/providers/images/pixabay
 */

const { get } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:pixabay');

module.exports = {
  id: 'pixabay',
  type: 'images',
  priority: 80,
  requiredKeys: ['pixabayApiKey'],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape images from Pixabay API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {boolean} [params.safeMode=true] - Filter NSFW
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, safeMode = true, signal }) {
    const apiKey = config.providers.pixabayApiKey;
    if (!apiKey) {
      log.warn('Pixabay API key not configured');
      return { items: [], meta: { page, hasMore: false, message: 'API key missing' } };
    }

    try {
      const perPage = Math.min(limit, 200);
      const response = await get('https://pixabay.com/api/', {
        params: {
          key: apiKey,
          q: keyword,
          page,
          per_page: perPage,
          safesearch: safeMode ? 'true' : 'false',
          image_type: 'all',
        },
        signal,
      });

      const data = response.data;
      const items = (data.hits || []).map(hit => ({
        title: hit.tags || keyword,
        url: hit.largeImageURL || hit.webformatURL || '',
        thumbnail: hit.previewURL || '',
        description: hit.tags || '',
        width: hit.imageWidth,
        height: hit.imageHeight,
        author: hit.user || 'Unknown',
        authorUrl: `https://pixabay.com/users/${hit.user_id}/`,
        source: 'pixabay',
        sourceUrl: hit.pageURL || '',
        downloadUrl: hit.largeImageURL || hit.webformatURL || '',
        license: 'Pixabay License',
      }));

      const totalHits = data.totalHits || 0;
      const totalPages = Math.ceil(totalHits / perPage);

      log.debug(`Pixabay: found ${items.length} images for "${keyword}"`);

      return {
        items,
        meta: {
          page,
          hasMore: page < totalPages,
          total: totalHits,
          message: `Pixabay: ${totalHits} total results`,
        },
      };
    } catch (err) {
      log.error('Pixabay scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

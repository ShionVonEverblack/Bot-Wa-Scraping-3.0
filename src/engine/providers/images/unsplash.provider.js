'use strict';

/**
 * @fileoverview Unsplash image provider.
 * @module engine/providers/images/unsplash
 */

const { get } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:unsplash');

module.exports = {
  id: 'unsplash',
  type: 'images',
  priority: 90,
  requiredKeys: ['unsplashAccessKey'],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape images from Unsplash API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {boolean} [params.safeMode=true] - Filter NSFW content
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, safeMode = true, signal }) {
    const apiKey = config.providers.unsplashAccessKey;
    if (!apiKey) {
      log.warn('Unsplash API key not configured');
      return { items: [], meta: { page, hasMore: false, message: 'API key missing' } };
    }

    try {
      const perPage = Math.min(limit, 30);
      const url = 'https://api.unsplash.com/search/photos';
      const response = await get(url, {
        params: {
          query: keyword,
          page,
          per_page: perPage,
          content_filter: safeMode ? 'high' : 'low',
        },
        headers: {
          'Authorization': `Client-ID ${apiKey}`,
        },
        signal,
      });

      const data = response.data;
      const items = (data.results || []).map(photo => ({
        title: photo.description || photo.alt_description || keyword,
        url: photo.urls?.regular || photo.urls?.full || '',
        thumbnail: photo.urls?.thumb || photo.urls?.small || '',
        description: photo.alt_description || '',
        width: photo.width,
        height: photo.height,
        author: photo.user?.name || 'Unknown',
        authorUrl: photo.user?.links?.html || '',
        source: 'unsplash',
        sourceUrl: photo.links?.html || '',
        downloadUrl: photo.urls?.full || '',
        license: 'Unsplash License',
      }));

      const totalPages = Math.ceil((data.total || 0) / perPage);

      log.debug(`Unsplash: found ${items.length} images for "${keyword}"`);

      return {
        items,
        meta: {
          page,
          hasMore: page < totalPages,
          total: data.total || 0,
          message: `Unsplash: ${data.total || 0} total results`,
        },
      };
    } catch (err) {
      log.error('Unsplash scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

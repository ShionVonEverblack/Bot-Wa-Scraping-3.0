'use strict';

/**
 * @fileoverview Pexels image provider.
 * @module engine/providers/images/pexels
 */

const { get } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:pexels');

module.exports = {
  id: 'pexels',
  type: 'images',
  priority: 85,
  requiredKeys: ['pexelsApiKey'],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape images from Pexels API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {boolean} [params.safeMode=true] - Filter NSFW
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, safeMode = true, signal }) {
    const apiKey = config.providers.pexelsApiKey;
    if (!apiKey) {
      log.warn('Pexels API key not configured');
      return { items: [], meta: { page, hasMore: false, message: 'API key missing' } };
    }

    try {
      const perPage = Math.min(limit, 80);
      const response = await get('https://api.pexels.com/v1/search', {
        params: { query: keyword, page, per_page: perPage },
        headers: { 'Authorization': apiKey },
        signal,
      });

      const data = response.data;
      const items = (data.photos || []).map(photo => ({
        title: photo.alt || keyword,
        url: photo.src?.large || photo.src?.original || '',
        thumbnail: photo.src?.tiny || photo.src?.small || '',
        description: photo.alt || '',
        width: photo.width,
        height: photo.height,
        author: photo.photographer || 'Unknown',
        authorUrl: photo.photographer_url || '',
        source: 'pexels',
        sourceUrl: photo.url || '',
        downloadUrl: photo.src?.original || '',
        license: 'Pexels License',
      }));

      const totalResults = data.total_results || 0;
      const totalPages = Math.ceil(totalResults / perPage);

      log.debug(`Pexels: found ${items.length} images for "${keyword}"`);

      return {
        items,
        meta: {
          page,
          hasMore: page < totalPages,
          total: totalResults,
          message: `Pexels: ${totalResults} total results`,
        },
      };
    } catch (err) {
      log.error('Pexels scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

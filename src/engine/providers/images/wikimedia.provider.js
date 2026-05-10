'use strict';

/**
 * @fileoverview Wikimedia Commons image provider (no API key required).
 * @module engine/providers/images/wikimedia
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:wikimedia');

module.exports = {
  id: 'wikimedia',
  type: 'images',
  priority: 60,
  requiredKeys: [],
  supportsPagination: { page: false, cursor: true },

  /**
   * Scrape images from Wikimedia Commons API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {string} [params.cursor] - Continue token for pagination
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, cursor, signal }) {
    try {
      const params = {
        action: 'query',
        generator: 'search',
        gsrsearch: `${keyword} filetype:bitmap`,
        gsrnamespace: 6, // File namespace
        gsrlimit: Math.min(limit, 50),
        prop: 'imageinfo',
        iiprop: 'url|size|mime|extmetadata',
        iiurlwidth: 800,
        format: 'json',
        origin: '*',
      };

      if (cursor) {
        params.gsroffset = cursor;
      }

      const response = await get('https://commons.wikimedia.org/w/api.php', {
        params,
        signal,
      });

      const data = response.data;
      const pages = data.query?.pages || {};

      const items = Object.values(pages)
        .filter(p => p.imageinfo && p.imageinfo.length > 0)
        .map(p => {
          const info = p.imageinfo[0];
          const meta = info.extmetadata || {};
          return {
            title: (p.title || '').replace(/^File:/, ''),
            url: info.thumburl || info.url || '',
            thumbnail: info.thumburl || '',
            description: meta.ImageDescription?.value?.replace(/<[^>]+>/g, '') || '',
            width: info.width,
            height: info.height,
            author: meta.Artist?.value?.replace(/<[^>]+>/g, '') || 'Unknown',
            source: 'wikimedia',
            sourceUrl: info.descriptionurl || '',
            downloadUrl: info.url || '',
            license: meta.LicenseShortName?.value || 'CC',
          };
        });

      const nextCursor = data.continue?.gsroffset || null;

      log.debug(`Wikimedia: found ${items.length} images for "${keyword}"`);

      return {
        items,
        meta: {
          page: null,
          hasMore: !!nextCursor,
          nextCursor,
          message: `Wikimedia Commons: ${items.length} results`,
        },
      };
    } catch (err) {
      log.error('Wikimedia scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

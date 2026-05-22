'use strict';

/**
 * @fileoverview Safebooru image provider (Anime/Manga art).
 * @module engine/providers/images/safebooru
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:safebooru');

module.exports = {
  id: 'safebooru',
  type: 'images',
  priority: 80,
  requiredKeys: [], // Safebooru API is public
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape images from Safebooru API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword (tags)
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number (Safebooru uses pid for page, 0-indexed)
   * @param {boolean} [params.safeMode=true] - Filter NSFW (always true for Safebooru anyway)
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, safeMode = true, signal }) {
    try {
      // Safebooru pages are 0-indexed, so page 1 is pid=0
      const pid = page - 1;
      const perPage = Math.min(limit, 100);

      // Convert spaces to underscores for Danbooru-style tags
      const tags = keyword.trim().replace(/\s+/g, '_');

      const response = await get('https://safebooru.org/index.php', {
        params: {
          page: 'dapi',
          s: 'post',
          q: 'index',
          json: 1,
          limit: perPage,
          pid: pid,
          tags: tags,
        },
        signal,
      });

      const data = response.data;
      if (!data || !Array.isArray(data) || data.length === 0) {
        return { items: [], meta: { page, hasMore: false } };
      }

      const items = data.map(post => {
        // Safebooru image directories are structured by directory/image.ext
        const imageUrl = `https://safebooru.org/images/${post.directory}/${post.image}`;
        const thumbnailUrl = `https://safebooru.org/thumbnails/${post.directory}/thumbnail_${post.image}`;

        return {
          title: `Anime Art (${post.tags.split(' ').slice(0, 3).join(', ')})`,
          url: imageUrl,
          thumbnail: thumbnailUrl,
          description: `Tags: ${post.tags}`,
          width: post.width,
          height: post.height,
          author: post.owner || 'Unknown',
          authorUrl: '',
          source: 'safebooru',
          sourceUrl: `https://safebooru.org/index.php?page=post&s=view&id=${post.id}`,
          downloadUrl: imageUrl,
          license: 'Public / Varies',
        };
      });

      log.debug(`Safebooru: found ${items.length} images for tags "${tags}"`);

      return {
        items: items.slice(0, limit),
        meta: {
          page,
          hasMore: items.length >= perPage,
          message: `Safebooru: ${items.length} results`,
        },
      };
    } catch (err) {
      log.error('Safebooru scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

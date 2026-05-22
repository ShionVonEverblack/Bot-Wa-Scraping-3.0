'use strict';

/**
 * @fileoverview Reddit image provider for fetching viral images, memes, and wallpapers.
 * @module engine/providers/images/redditImages
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:redditImages');

module.exports = {
  id: 'redditImages',
  type: 'images',
  priority: 75,
  requiredKeys: [], // Reddit JSON API is public
  supportsPagination: { page: false, cursor: true },

  /**
   * Scrape images from Reddit Search API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {boolean} [params.safeMode=true] - Filter NSFW
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @param {string} [params.cursor] - Pagination cursor (after)
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, safeMode = true, signal, cursor }) {
    try {
      // For images, we append "url:jpg OR url:png" to ensure we get direct images.
      // Also we can filter by type=link to avoid fetching subreddits.
      const query = `${keyword} (url:.jpg OR url:.png OR url:.jpeg)`;

      const response = await get('https://www.reddit.com/search.json', {
        params: {
          q: query,
          limit: Math.min(limit * 2, 100), // Fetch more because some might not be images despite the search
          include_over_18: safeMode ? 'off' : 'on',
          after: cursor || undefined,
          sort: 'relevance',
          type: 'link',
        },
        headers: {
          'User-Agent': 'WhatsAppBotScraper/3.0',
        },
        signal,
      });

      const data = response.data?.data;
      if (!data || !data.children || data.children.length === 0) {
        return { items: [], meta: { hasMore: false } };
      }

      const items = [];
      for (const child of data.children) {
        const post = child.data;
        if (!post) continue;

        // Ensure it's an image
        const url = post.url || '';
        const isImage = url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.gif');
        
        if (isImage) {
          items.push({
            title: post.title || 'Reddit Image',
            url: url,
            thumbnail: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : url,
            description: `Upvotes: ${post.score} | Comments: ${post.num_comments}`,
            author: post.author || 'Unknown',
            authorUrl: `https://www.reddit.com/user/${post.author}`,
            source: 'reddit',
            sourceUrl: `https://www.reddit.com${post.permalink}`,
            downloadUrl: url,
            license: 'Public / Varies',
          });
        }

        if (items.length >= limit) break;
      }

      log.debug(`RedditImages: found ${items.length} image results for "${keyword}"`);

      return {
        items: items,
        meta: {
          hasMore: !!data.after,
          cursor: data.after,
          message: `Reddit: ${items.length} image posts`,
        },
      };
    } catch (err) {
      log.error('RedditImages scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

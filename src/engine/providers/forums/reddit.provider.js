'use strict';

/**
 * @fileoverview Reddit search provider for finding discussions and public opinions.
 * @module engine/providers/forums/reddit
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:reddit');

module.exports = {
  id: 'reddit',
  type: 'forums',
  priority: 90,
  requiredKeys: [],
  supportsPagination: { page: false, cursor: true },

  /**
   * Scrape results from Reddit Search API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {boolean} [params.safeMode=true] - Safe search
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @param {string} [params.cursor] - Pagination cursor (after)
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, safeMode = true, signal, cursor }) {
    try {
      const response = await get('https://www.reddit.com/search.json', {
        params: {
          q: keyword,
          limit: Math.min(limit, 100), // Reddit allows up to 100
          include_over_18: safeMode ? 'off' : 'on',
          after: cursor || undefined,
          sort: 'relevance', // Can be relevance, hot, top, new
          type: 'link', // Only search posts (link), not subreddits or users
        },
        // It's good practice to provide a User-Agent for Reddit API to avoid 429
        headers: {
          'User-Agent': 'WhatsAppBotScraper/3.0',
        },
        signal,
      });

      const data = response.data?.data;
      if (!data || !data.children) {
        return { items: [], meta: { hasMore: false } };
      }

      const items = data.children.map(child => {
        const post = child.data;
        return {
          title: post.title || '',
          url: `https://www.reddit.com${post.permalink}`,
          description: post.selftext ? post.selftext.slice(0, 300) + (post.selftext.length > 300 ? '...' : '') : '',
          source: 'reddit',
          sourceUrl: `https://www.reddit.com/${post.subreddit_name_prefixed}`,
          type: 'discussion',
          author: post.author,
          upvotes: post.score,
          comments: post.num_comments,
          subreddit: post.subreddit_name_prefixed,
          thumbnail: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : '',
        };
      });

      log.debug(`Reddit: found ${items.length} results for "${keyword}"`);

      return {
        items: items.slice(0, limit),
        meta: {
          hasMore: !!data.after,
          cursor: data.after,
          message: `Reddit: ${items.length} posts`,
        },
      };
    } catch (err) {
      log.error('Reddit scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

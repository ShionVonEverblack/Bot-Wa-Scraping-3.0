'use strict';

/**
 * @fileoverview Hacker News (Algolia API) technology & startup discussions provider.
 * Free real-time access to tech articles, developer discussions, points, and comments.
 * @module engine/providers/forums/hackernews
 */

const httpClient = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:hackernews');

module.exports = {
  id: 'hackernews',
  type: 'forums',
  priority: 85,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Search tech stories and discussions on Hacker News.
   * @param {Object} params
   * @param {string} params.keyword - Search query
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number (1-based)
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const hitsPerPage = Math.min(limit, 30);
      const algoliaPage = Math.max(0, page - 1);

      const response = await httpClient.get('https://hn.algolia.com/api/v1/search', {
        params: {
          query: keyword,
          tags: 'story',
          hitsPerPage,
          page: algoliaPage,
        },
        signal,
        timeout: 15000,
      });

      const data = response.data || {};
      const hits = data.hits || [];
      const total = data.nbHits || 0;

      const items = hits.map(hit => {
        const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
        const targetUrl = hit.url || hnUrl;
        const points = hit.points || 0;
        const comments = hit.num_comments || 0;
        const author = hit.author || 'anonymous';
        const dateStr = hit.created_at ? new Date(hit.created_at).toLocaleDateString() : '';

        return {
          title: hit.title || 'Untitled Discussion',
          url: targetUrl,
          description: `By: ${author} | ${points} points | ${comments} comments | Date: ${dateStr}. HN discussion: ${hnUrl}`,
          source: 'hackernews',
          sourceUrl: hnUrl,
          points,
          comments,
          author,
          hnId: hit.objectID,
          createdAt: hit.created_at || null,
        };
      });

      return {
        items,
        meta: {
          page,
          hasMore: algoliaPage + 1 < (data.nbPages || 0),
          total,
          message: `Hacker News: found ${items.length} discussions for "${keyword}"`,
        },
      };
    } catch (err) {
      log.error('Hacker News search failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

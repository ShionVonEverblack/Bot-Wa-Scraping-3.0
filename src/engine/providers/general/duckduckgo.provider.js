'use strict';

/**
 * @fileoverview DuckDuckGo instant answer provider.
 * @module engine/providers/general/duckduckgo
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:duckduckgo');

module.exports = {
  id: 'duckduckgo',
  type: 'general',
  priority: 70,
  requiredKeys: [],
  supportsPagination: { page: false, cursor: false },

  /**
   * Scrape results from DuckDuckGo Instant Answer API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {boolean} [params.safeMode=true] - Safe search
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, safeMode = true, signal }) {
    try {
      const response = await get('https://api.duckduckgo.com/', {
        params: {
          q: keyword,
          format: 'json',
          no_html: 1,
          skip_disambig: 1,
          kp: safeMode ? 1 : -1,
        },
        signal,
      });

      const data = response.data;
      const items = [];

      // Abstract (main answer)
      if (data.Abstract) {
        items.push({
          title: data.Heading || keyword,
          url: data.AbstractURL || '',
          description: data.Abstract || '',
          source: 'duckduckgo',
          sourceUrl: data.AbstractURL || '',
          type: 'abstract',
          thumbnail: data.Image ? `https://duckduckgo.com${data.Image}` : '',
        });
      }

      // Related topics
      const topics = data.RelatedTopics || [];
      for (const topic of topics.slice(0, limit - items.length)) {
        if (topic.Text && topic.FirstURL) {
          items.push({
            title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 80),
            url: topic.FirstURL,
            description: topic.Text || '',
            source: 'duckduckgo',
            sourceUrl: topic.FirstURL,
            type: 'related',
            thumbnail: topic.Icon?.URL || '',
          });
        }

        // Sub-topics
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 3)) {
            if (sub.Text && sub.FirstURL && items.length < limit) {
              items.push({
                title: sub.Text.split(' - ')[0] || sub.Text.slice(0, 80),
                url: sub.FirstURL,
                description: sub.Text || '',
                source: 'duckduckgo',
                sourceUrl: sub.FirstURL,
                type: 'related',
              });
            }
          }
        }
      }

      // Results (if available)
      if (data.Results) {
        for (const result of data.Results.slice(0, limit - items.length)) {
          items.push({
            title: result.Text?.split(' - ')[0] || '',
            url: result.FirstURL || '',
            description: result.Text || '',
            source: 'duckduckgo',
            sourceUrl: result.FirstURL || '',
            type: 'result',
          });
        }
      }

      log.debug(`DuckDuckGo: found ${items.length} results for "${keyword}"`);

      return {
        items: items.slice(0, limit),
        meta: {
          hasMore: false,
          message: `DuckDuckGo: ${items.length} results`,
          type: data.Type || 'unknown',
        },
      };
    } catch (err) {
      log.error('DuckDuckGo scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

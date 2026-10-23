'use strict';

/**
 * @fileoverview GitHub open-source code repository provider.
 * Free repository search with stars, forks, languages, and topics.
 * @module engine/providers/code/github
 */

const httpClient = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:github');

module.exports = {
  id: 'github',
  type: 'code',
  priority: 95,
  requiredKeys: [], // Works without token (60 req/hr), higher rate limit if token provided
  supportsPagination: { page: true, cursor: false },

  /**
   * Search repositories on GitHub.
   * @param {Object} params
   * @param {string} params.keyword - Search query
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const perPage = Math.min(limit, 30);
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Rima-Bot-WA',
      };

      const token = config.providers.githubToken;
      if (token) {
        headers.Authorization = `token ${token}`;
      }

      const response = await httpClient.get('https://api.github.com/search/repositories', {
        params: {
          q: keyword,
          sort: 'stars',
          order: 'desc',
          per_page: perPage,
          page,
        },
        headers,
        signal,
        timeout: 15000,
      });

      const data = response.data || {};
      const repos = data.items || [];
      const total = data.total_count || 0;

      const items = repos.map(repo => {
        const stars = repo.stargazers_count || 0;
        const forks = repo.forks_count || 0;
        const lang = repo.language || 'Code';
        const license = repo.license?.spdx_id || repo.license?.name || 'No License';

        return {
          title: repo.full_name || repo.name,
          url: repo.html_url || '',
          description: (repo.description || 'No description provided.').slice(0, 300),
          source: 'github',
          sourceUrl: repo.html_url || '',
          stars,
          forks,
          language: lang,
          author: repo.owner?.login || '',
          license,
          topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 5).join(', ') : '',
          updatedAt: repo.updated_at || null,
        };
      });

      return {
        items,
        meta: {
          page,
          hasMore: page * perPage < total,
          total,
          message: `GitHub: found ${items.length} repositories for "${keyword}"`,
        },
      };
    } catch (err) {
      log.error('GitHub search failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

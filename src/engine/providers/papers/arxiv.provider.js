'use strict';

/**
 * @fileoverview arXiv paper provider (free, XML response parsing).
 * @module engine/providers/papers/arxiv
 */

const { get } = require('../../../utils/httpClient');
const xml2js = require('xml2js');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:arxiv');

/**
 * Parse XML string to JS object.
 * @param {string} xml
 * @returns {Promise<Object>}
 */
async function parseXml(xml) {
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
  return parser.parseStringPromise(xml);
}

module.exports = {
  id: 'arxiv',
  type: 'papers',
  priority: 85,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape papers from arXiv API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const maxResults = Math.min(limit, 100);
      const start = (page - 1) * maxResults;

      const response = await get('http://export.arxiv.org/api/query', {
        params: {
          search_query: `all:${keyword}`,
          start,
          max_results: maxResults,
          sortBy: 'relevance',
          sortOrder: 'descending',
        },
        signal,
        headers: { 'Accept': 'application/xml' },
        responseType: 'text',
      });

      const parsed = await parseXml(response.data);
      const feed = parsed.feed || {};
      const entries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];

      const items = entries.map(entry => {
        const authors = entry.author
          ? (Array.isArray(entry.author) ? entry.author : [entry.author])
              .map(a => a.name || '').filter(Boolean).join(', ')
          : '';

        const links = entry.link
          ? (Array.isArray(entry.link) ? entry.link : [entry.link])
          : [];

        const pdfLink = links.find(l => l.$?.title === 'pdf');
        const htmlLink = links.find(l => l.$?.type === 'text/html');

        // Extract arXiv ID from the entry id URL
        const idUrl = entry.id || '';
        const arxivId = idUrl.replace('http://arxiv.org/abs/', '').replace(/v\d+$/, '');

        return {
          title: (entry.title || '').replace(/\s+/g, ' ').trim(),
          url: htmlLink?.$?.href || entry.id || '',
          description: (entry.summary || '').replace(/\s+/g, ' ').trim().slice(0, 500),
          authors,
          year: entry.published ? new Date(entry.published).getFullYear() : null,
          doi: null,
          arxivId,
          source: 'arxiv',
          sourceUrl: entry.id || '',
          pdfUrl: pdfLink?.$?.href || null,
          categories: entry.category
            ? (Array.isArray(entry.category) ? entry.category : [entry.category])
                .map(c => c.$?.term).filter(Boolean).join(', ')
            : '',
          isOpenAccess: true,
        };
      });

      const totalStr = feed['opensearch:totalResults']?._ || feed['opensearch:totalResults'] || '0';
      const total = parseInt(totalStr, 10) || 0;

      log.debug(`arXiv: found ${items.length} papers for "${keyword}"`);

      return {
        items,
        meta: {
          page,
          hasMore: start + maxResults < total,
          total,
          message: `arXiv: ${total} total results`,
        },
      };
    } catch (err) {
      log.error('arXiv scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

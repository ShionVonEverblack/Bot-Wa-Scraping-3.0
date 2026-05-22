'use strict';

/**
 * @fileoverview Europe PMC paper provider.
 * Searches PubMed, PMC, and other biomedical literature.
 * @module engine/providers/papers/europepmc
 */

const { get } = require('../../../utils/httpClient');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:europepmc');

module.exports = {
  id: 'europepmc',
  type: 'papers',
  priority: 85,
  requiredKeys: [], // Europe PMC is fully public
  supportsPagination: { page: false, cursor: true }, // EuropePMC uses cursorMark

  /**
   * Scrape results from Europe PMC API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {boolean} [params.safeMode=true] - Ignored
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, signal, cursor }) {
    try {
      const perPage = Math.min(limit, 100);
      const cursorMark = cursor || '*';

      const response = await get('https://www.ebi.ac.uk/europepmc/webservices/rest/search', {
        params: {
          query: keyword,
          format: 'json',
          resultType: 'core',
          cursorMark: cursorMark,
          pageSize: perPage,
        },
        signal,
      });

      const data = response.data;
      if (!data || !data.resultList || !data.resultList.result) {
        return { items: [], meta: { hasMore: false } };
      }

      const items = data.resultList.result.map(work => {
        const title = work.title || 'Untitled';
        // Authors usually provided in authorString
        const authors = work.authorString || 'Unknown';
        const year = work.pubYear || 'Unknown';
        const journal = work.journalTitle || work.bookOrReportDetails?.publisher || 'Unknown';
        const doi = work.doi || '';
        const pmid = work.pmid || '';
        const pmcid = work.pmcid || '';

        // Prioritize full text PDF link if available, otherwise DOI link, otherwise europePMC link
        let url = `https://europepmc.org/article/MED/${pmid}`;
        if (pmcid) {
          url = `https://europepmc.org/articles/${pmcid}`;
        } else if (doi) {
          url = `https://doi.org/${doi}`;
        }

        let downloadUrl = '';
        if (work.fullTextUrlList && work.fullTextUrlList.fullTextUrl) {
          const pdfLink = work.fullTextUrlList.fullTextUrl.find(l => l.documentStyle === 'pdf');
          if (pdfLink) {
            downloadUrl = pdfLink.url;
          }
        }

        return {
          title: title,
          url: url,
          description: work.abstractText || 'No abstract available.',
          source: 'europepmc',
          sourceUrl: url,
          type: 'paper',
          authors: authors,
          year: year,
          journal: journal,
          doi: doi,
          downloadUrl: downloadUrl,
          citations: work.citedByCount || 0,
        };
      });

      log.debug(`EuropePMC: found ${items.length} papers for "${keyword}"`);

      const hasMore = !!data.nextCursorMark;

      return {
        items: items.slice(0, limit),
        meta: {
          hasMore,
          cursor: data.nextCursorMark,
          totalResults: data.hitCount || 0,
          message: `EuropePMC: ${data.hitCount || items.length} results`,
        },
      };
    } catch (err) {
      log.error('EuropePMC scrape failed', { error: err.message });
      return { items: [], meta: { hasMore: false, message: err.message } };
    }
  },
};

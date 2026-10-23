'use strict';

/**
 * @fileoverview Unpaywall Open Access paper provider & DOI resolver.
 * Finds legal, free full-text open-access PDFs for research papers.
 * @module engine/providers/papers/unpaywall
 */

const httpClient = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:unpaywall');

const DOI_REGEX = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/;

module.exports = {
  id: 'unpaywall',
  type: 'papers',
  priority: 82,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape / Resolve Open Access papers from Unpaywall.
   * @param {Object} params
   * @param {string} params.keyword - DOI or title/keyword search
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const email = config.providers.unpaywallEmail || config.providers.openalexEmail || config.providers.contactEmail || 'bot@example.com';
      const cleanKeyword = String(keyword || '').trim();
      const doiMatch = cleanKeyword.match(DOI_REGEX);

      // 1. Direct DOI resolution via Unpaywall API
      if (doiMatch) {
        const doi = doiMatch[1].replace(/[.,;]+$/, '');
        const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`;
        const response = await httpClient.get(url, {
          params: { email },
          signal,
          timeout: 12000,
        });

        const data = response.data;
        if (!data || !data.doi) {
          return { items: [], meta: { page, hasMore: false, total: 0 } };
        }

        const bestOa = data.best_oa_location || {};
        const authors = Array.isArray(data.z_authors)
          ? data.z_authors.map(a => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean).join(', ')
          : '';

        const item = {
          title: data.title || doi,
          url: bestOa.url_for_pdf || bestOa.url || `https://doi.org/${doi}`,
          description: `Published in ${data.journal_name || 'Academic Journal'} (${data.year || 'N/A'}). OA Status: ${data.oa_status || (data.is_oa ? 'Open Access' : 'Closed')}.`,
          authors,
          year: data.year ? parseInt(data.year, 10) : null,
          doi: data.doi,
          source: 'unpaywall',
          sourceUrl: `https://doi.org/${doi}`,
          pdfUrl: bestOa.url_for_pdf || bestOa.url || null,
          isOpenAccess: Boolean(data.is_oa),
          hostType: bestOa.host_type || 'repository',
          license: bestOa.license || null,
        };

        return {
          items: [item],
          meta: { page: 1, hasMore: false, total: 1, message: 'Unpaywall direct DOI resolved' },
        };
      }

      // 2. Free-text search via OpenAlex with OA filter, enriched by Unpaywall
      const oaUrl = 'https://api.openalex.org/works';
      const response = await httpClient.get(oaUrl, {
        params: {
          search: cleanKeyword,
          per_page: Math.min(limit, 25),
          page,
          filter: 'is_oa:true',
        },
        signal,
        timeout: 15000,
      });

      const results = response.data?.results || [];
      const items = results.map(work => {
        const bestOa = work.best_oa_location || work.primary_location || {};
        const authors = Array.isArray(work.authorships)
          ? work.authorships.map(a => a.author?.display_name).filter(Boolean).join(', ')
          : '';

        const doi = work.doi ? work.doi.replace(/^https?:\/\/doi\.org\//i, '') : null;

        return {
          title: work.title || cleanKeyword,
          url: bestOa.pdf_url || bestOa.landing_page_url || work.doi || '',
          description: `Open Access paper published in ${work.primary_location?.source?.display_name || 'Academic Venue'} (${work.publication_year || 'N/A'}). Citations: ${work.cited_by_count || 0}.`,
          authors,
          year: work.publication_year || null,
          doi,
          source: 'unpaywall',
          sourceUrl: work.doi || (doi ? `https://doi.org/${doi}` : ''),
          pdfUrl: bestOa.pdf_url || null,
          isOpenAccess: true,
          citationCount: work.cited_by_count || 0,
        };
      });

      const total = response.data?.meta?.count || items.length;

      return {
        items,
        meta: {
          page,
          hasMore: page * limit < total,
          total,
          message: `Unpaywall (Open Access): ${items.length} works found`,
        },
      };
    } catch (err) {
      log.error('Unpaywall search failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

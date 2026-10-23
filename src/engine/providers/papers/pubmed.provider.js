'use strict';

/**
 * @fileoverview PubMed & PMC (NCBI E-utilities) biomedical literature provider.
 * Free search across 36M+ medical & biological citations and direct PMC full-text PDFs.
 * @module engine/providers/papers/pubmed
 */

const httpClient = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:pubmed');

module.exports = {
  id: 'pubmed',
  type: 'papers',
  priority: 88,
  requiredKeys: [],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape PubMed literature using NCBI E-utilities.
   * @param {Object} params
   * @param {string} params.keyword - Search query
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    try {
      const apiKey = config.providers.ncbiApiKey || '';
      const retmax = Math.min(limit, 50);
      const retstart = (page - 1) * retmax;

      // 1. ESearch step to get PMIDs
      const searchParams = {
        db: 'pubmed',
        term: keyword,
        retmode: 'json',
        retstart,
        retmax,
        sort: 'relevance',
      };
      if (apiKey) searchParams.api_key = apiKey;

      const searchResp = await httpClient.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi', {
        params: searchParams,
        signal,
        timeout: 15000,
      });

      const idList = searchResp.data?.esearchresult?.idlist || [];
      const total = parseInt(searchResp.data?.esearchresult?.count || '0', 10);

      if (idList.length === 0) {
        return { items: [], meta: { page, hasMore: false, total: 0 } };
      }

      // 2. ESummary step to get metadata
      const summaryParams = {
        db: 'pubmed',
        id: idList.join(','),
        retmode: 'json',
      };
      if (apiKey) summaryParams.api_key = apiKey;

      const summaryResp = await httpClient.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi', {
        params: summaryParams,
        signal,
        timeout: 15000,
      });

      const resultObj = summaryResp.data?.result || {};
      const uids = resultObj.uids || idList;

      const items = uids.map(uid => {
        const doc = resultObj[uid] || {};
        const authors = Array.isArray(doc.authors)
          ? doc.authors.map(a => a.name).filter(Boolean).join(', ')
          : '';

        const articleIds = Array.isArray(doc.articleids) ? doc.articleids : [];
        const doiItem = articleIds.find(i => i.idtype === 'doi');
        const pmcItem = articleIds.find(i => i.idtype === 'pmc');
        const doi = doiItem ? doiItem.value : null;
        const pmcId = pmcItem ? pmcItem.value : null;

        const pubYearMatch = String(doc.pubdate || '').match(/\b(19\d\d|20\d\d)\b/);
        const year = pubYearMatch ? parseInt(pubYearMatch[1], 10) : null;

        const pdfUrl = pmcId
          ? `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${pmcId}&blobtype=pdf`
          : null;

        return {
          title: (doc.title || `PMID:${uid}`).replace(/<[^>]+>/g, '').trim(),
          url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
          description: `Journal: ${doc.source || 'Medical Journal'}. Publication Date: ${doc.pubdate || 'N/A'}. PMID: ${uid}${pmcId ? ` | PMC: ${pmcId}` : ''}`,
          authors,
          year,
          doi,
          pmid: uid,
          pmcId,
          source: 'pubmed',
          sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
          pdfUrl,
          isOpenAccess: Boolean(pmcId),
        };
      });

      return {
        items,
        meta: {
          page,
          hasMore: retstart + idList.length < total,
          total,
          message: `PubMed: found ${items.length} citations for "${keyword}"`,
        },
      };
    } catch (err) {
      log.error('PubMed scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

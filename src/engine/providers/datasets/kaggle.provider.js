'use strict';

/**
 * @fileoverview Kaggle dataset provider.
 * @module engine/providers/datasets/kaggle
 */

const { get } = require('../../../utils/httpClient');
const config = require('../../../config');
const { createLogger } = require('../../../services/monitor/logger');

const log = createLogger('provider:kaggle');

const BASE_URL = 'https://www.kaggle.com/api/v1';

module.exports = {
  id: 'kaggle',
  type: 'datasets',
  priority: 90,
  requiredKeys: ['kaggleUsername', 'kaggleKey'],
  supportsPagination: { page: true, cursor: false },

  /**
   * Scrape datasets from Kaggle API.
   * @param {Object} params
   * @param {string} params.keyword - Search keyword
   * @param {number} [params.limit=10] - Max results
   * @param {number} [params.page=1] - Page number
   * @param {AbortSignal} [params.signal] - Cancellation signal
   * @returns {Promise<{items:Array, meta:Object}>}
   */
  async scrape({ keyword, limit = 10, page = 1, signal }) {
    const username = config.providers.kaggleUsername;
    const key = config.providers.kaggleKey;

    if (!username || !key) {
      log.warn('Kaggle credentials not configured');
      return { items: [], meta: { page, hasMore: false, message: 'Kaggle credentials missing' } };
    }

    try {
      const auth = Buffer.from(`${username}:${key}`).toString('base64');
      const perPage = Math.min(limit, 20);

      const response = await get(`${BASE_URL}/datasets/list`, {
        params: {
          search: keyword,
          page,
          pageSize: perPage,
          sortBy: 'hottest',
        },
        headers: {
          'Authorization': `Basic ${auth}`,
        },
        signal,
      });

      const data = Array.isArray(response.data) ? response.data : [];

      const items = data.map(ds => ({
        title: ds.title || ds.ref || 'Untitled',
        url: `https://www.kaggle.com/datasets/${ds.ref}`,
        description: ds.subtitle || ds.description || '',
        author: ds.creatorName || ds.ownerName || 'Unknown',
        source: 'kaggle',
        sourceUrl: `https://www.kaggle.com/datasets/${ds.ref}`,
        downloadUrl: `https://www.kaggle.com/datasets/${ds.ref}/download`,
        size: ds.totalBytes ? formatBytes(ds.totalBytes) : 'Unknown',
        usabilityRating: ds.usabilityRating || null,
        voteCount: ds.voteCount || 0,
        downloadCount: ds.downloadCount || 0,
        lastUpdated: ds.lastUpdated || null,
        license: ds.licenseName || '',
        fileCount: ds.totalCompressedFileSize ? undefined : (ds.fileCount || null),
      }));

      log.debug(`Kaggle: found ${items.length} datasets for "${keyword}"`);

      return {
        items,
        meta: {
          page,
          hasMore: items.length >= perPage,
          message: `Kaggle: ${items.length} datasets found`,
        },
      };
    } catch (err) {
      log.error('Kaggle scrape failed', { error: err.message });
      return { items: [], meta: { page, hasMore: false, message: err.message } };
    }
  },
};

/**
 * Format byte count to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

'use strict';

/**
 * @fileoverview Smart provider router — priority-based routing with fallback chain.
 * @module engine/providerRouter
 */

const providerRegistry = require('./providers');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('engine:router');

/**
 * Route a scrape request to the best available provider(s).
 * Strategy: priority → config override → fallback chain.
 *
 * @param {Object} params
 * @param {string} params.type - Scrape type (images, papers, datasets, general)
 * @param {string} [params.provider] - Specific provider ID override
 * @param {string} params.keyword - Search keyword
 * @param {number} [params.limit=10] - Max results
 * @param {number} [params.page=1] - Page number
 * @param {string} [params.cursor] - Pagination cursor
 * @param {boolean} [params.safeMode=true] - Safe mode
 * @param {AbortSignal} [params.signal] - Cancellation signal
 * @returns {Promise<{items:Array, meta:Object, providerUsed:string}>}
 */
async function route({ type, provider, keyword, limit = 10, page = 1, cursor, safeMode = true, signal }) {
  // 1. If specific provider requested, use it directly
  if (provider) {
    const specific = providerRegistry.getById(provider);
    if (specific && providerRegistry.isAvailable(provider)) {
      log.info(`Routing to specific provider: ${provider}`);
      try {
        const result = await specific.scrape({ keyword, limit, page, cursor, safeMode, signal });
        return { ...result, providerUsed: provider };
      } catch (err) {
        log.error(`Specific provider ${provider} failed`, { error: err.message });
        // Fall through to type-based routing
      }
    } else {
      log.warn(`Requested provider "${provider}" not available, falling back to type-based routing`);
    }
  }

  // 2. Get providers for this type, sorted by priority
  const providers = providerRegistry.getByType(type);

  if (providers.length === 0) {
    log.warn(`No providers available for type: ${type}`);
    return {
      items: [],
      meta: { hasMore: false, message: `No providers available for type: ${type}` },
      providerUsed: 'none',
    };
  }

  // 3. Try each provider in priority order (fallback chain)
  const errors = [];

  for (const prov of providers) {
    if (signal && signal.aborted) {
      log.info('Request cancelled');
      return { items: [], meta: { hasMore: false, message: 'Cancelled' }, providerUsed: 'none' };
    }

    try {
      log.debug(`Trying provider: ${prov.id} (priority=${prov.priority})`);
      const result = await prov.scrape({ keyword, limit, page, cursor, safeMode, signal });

      if (result.items && result.items.length > 0) {
        log.info(`Provider ${prov.id} returned ${result.items.length} items`);
        return { ...result, providerUsed: prov.id };
      }

      log.debug(`Provider ${prov.id} returned empty results, trying next`);
    } catch (err) {
      log.warn(`Provider ${prov.id} failed: ${err.message}`);
      errors.push({ provider: prov.id, error: err.message });
    }
  }

  // 4. All providers exhausted
  log.warn(`All ${providers.length} providers for type "${type}" returned no results`, { errors });

  return {
    items: [],
    meta: {
      hasMore: false,
      message: `No results from ${providers.length} providers. Errors: ${errors.map(e => e.provider).join(', ')}`,
    },
    providerUsed: 'none',
  };
}

/**
 * Route to multiple providers concurrently and merge results.
 * Useful for aggregating results from all providers of a type.
 *
 * @param {Object} params - Same as route()
 * @param {number} [maxProviders=3] - Max providers to query concurrently
 * @returns {Promise<{items:Array, meta:Object, providersUsed:string[]}>}
 */
async function routeMulti({ type, keyword, limit = 10, page = 1, safeMode = true, signal }, maxProviders = 3) {
  const providers = providerRegistry.getByType(type).slice(0, maxProviders);

  if (providers.length === 0) {
    return { items: [], meta: { hasMore: false }, providersUsed: [] };
  }

  const perProviderLimit = Math.ceil(limit / providers.length);

  const promises = providers.map(async (prov) => {
    try {
      const result = await prov.scrape({ keyword, limit: perProviderLimit, page, safeMode, signal });
      return { providerId: prov.id, ...result };
    } catch (err) {
      log.warn(`Multi-route: ${prov.id} failed`, { error: err.message });
      return { providerId: prov.id, items: [], meta: {} };
    }
  });

  const results = await Promise.allSettled(promises);
  const allItems = [];
  const providersUsed = [];
  let hasMore = false;

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.items) {
      allItems.push(...result.value.items);
      providersUsed.push(result.value.providerId);
      if (result.value.meta?.hasMore) hasMore = true;
    }
  }

  // Limit total results
  const finalItems = allItems.slice(0, limit);

  return {
    items: finalItems,
    meta: { hasMore, total: allItems.length },
    providersUsed,
  };
}

module.exports = { route, routeMulti };

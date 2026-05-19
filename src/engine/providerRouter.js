'use strict';

/**
 * @fileoverview Smart provider router — priority-based routing with per-provider retry + fallback chain.
 * @module engine/providerRouter
 */

const providerRegistry = require('./providers');
const { createLogger } = require('../services/monitor/logger');
const circuitBreaker = require('../services/resilience/circuitBreaker');

const log = createLogger('engine:router');

/** Max retries per provider before moving to next. */
const MAX_RETRIES = 2;

/** Base delay for exponential backoff (ms). */
const BASE_DELAY = 1000;

/**
 * Sleep for a given duration.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Check if an error is retryable (network/transient issues).
 * @param {Error} err
 * @returns {boolean}
 */
function isRetryable(err) {
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';

  // Network errors — always retry
  if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) return true;

  // HTTP 5xx, 429 — retry
  if (err.response?.status >= 500) return true;
  if (err.response?.status === 429) return true;
  if (msg.includes('timeout') || msg.includes('socket hang up') || msg.includes('network')) return true;

  // Non-retryable: 4xx (except 429), auth errors, parse errors
  return false;
}

/**
 * Try scraping with a single provider, with retries.
 * @param {Object} prov - Provider instance
 * @param {Object} scrapeParams - Params to pass to prov.scrape()
 * @param {number} maxRetries - Max retry attempts
 * @returns {Promise<{items:Array, meta:Object}|null>} Result or null if all retries exhausted
 */
async function tryProviderWithRetry(prov, scrapeParams, maxRetries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await prov.scrape(scrapeParams);

      if (result.items && result.items.length > 0) {
        if (attempt > 1) log.info(`Provider ${prov.id} succeeded on retry #${attempt}`);
        circuitBreaker.recordSuccess(prov.id);
        return result;
      }

      // Empty results — not an error, don't retry
      log.debug(`Provider ${prov.id} returned empty results`);
      return null;
    } catch (err) {
      const retriesLeft = maxRetries - attempt;

      if (retriesLeft > 0 && isRetryable(err)) {
        const delay = BASE_DELAY * Math.pow(2, attempt - 1); // 1s, 2s
        log.warn(`Provider ${prov.id} attempt ${attempt}/${maxRetries} failed (retryable): ${err.message} — retrying in ${delay}ms`);
        await sleep(delay);
      } else {
        // Last attempt or non-retryable error
        log.warn(`Provider ${prov.id} failed (${retriesLeft > 0 ? 'non-retryable' : 'max retries'}): ${err.message}`);
        circuitBreaker.recordFailure(prov.id);
        throw err; // Let caller handle
      }
    }
  }
  return null;
}

/**
 * Route a scrape request to the best available provider(s).
 * Strategy: priority → config override → fallback chain.
 * Each provider gets up to MAX_RETRIES attempts before moving to the next.
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
  const scrapeParams = { keyword, limit, page, cursor, safeMode, signal };

  // 1. If specific provider requested, use it directly (with retry)
  if (provider) {
    const specific = providerRegistry.getById(provider);
    if (specific && providerRegistry.isAvailable(provider)) {
      log.info(`Routing to specific provider: ${provider}`);
      try {
        const result = await tryProviderWithRetry(specific, scrapeParams);
        if (result) return { ...result, providerUsed: provider };
      } catch (err) {
        log.error(`Specific provider ${provider} exhausted retries`, { error: err.message });
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

  // 3. Try each provider in priority order (fallback chain) — each gets retries
  const errors = [];

  for (const prov of providers) {
    if (signal && signal.aborted) {
      log.info('Request cancelled');
      return { items: [], meta: { hasMore: false, message: 'Cancelled' }, providerUsed: 'none' };
    }

    // Skip providers with open circuit
    if (circuitBreaker.isOpen(prov.id)) {
      log.debug(`Skipping ${prov.id} — circuit open`);
      continue;
    }

    try {
      log.debug(`Trying provider: ${prov.id} (priority=${prov.priority})`);
      const result = await tryProviderWithRetry(prov, scrapeParams);

      if (result) {
        log.info(`Provider ${prov.id} returned ${result.items.length} items`);
        return { ...result, providerUsed: prov.id };
      }

      log.debug(`Provider ${prov.id} returned empty results, trying next`);
    } catch (err) {
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
 * Each provider gets retries independently.
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
  const scrapeParams = { keyword, limit: perProviderLimit, page, safeMode, signal };

  const promises = providers.map(async (prov) => {
    if (circuitBreaker.isOpen(prov.id)) {
      log.debug(`Multi-route: skipping ${prov.id} — circuit open`);
      return { providerId: prov.id, items: [], meta: {} };
    }

    try {
      const result = await tryProviderWithRetry(prov, scrapeParams, 1); // 1 retry for multi
      return { providerId: prov.id, ...(result || { items: [], meta: {} }) };
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
      if (result.value.items.length > 0) providersUsed.push(result.value.providerId);
      if (result.value.meta?.hasMore) hasMore = true;
    }
  }

  const finalItems = allItems.slice(0, limit);

  return {
    items: finalItems,
    meta: { hasMore, total: allItems.length },
    providersUsed,
  };
}

module.exports = { route, routeMulti };


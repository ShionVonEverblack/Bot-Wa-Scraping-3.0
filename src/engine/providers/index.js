'use strict';

/**
 * @fileoverview Provider registry — register, enable/disable, lookup by type/id, validate.
 * Auto-discovers all provider files in subdirectories.
 * @module engine/providers/index
 */

const path = require('path');
const fs = require('fs');
const config = require('../../config');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('engine:registry');

/** @type {Map<string, Object>} All registered providers by id. */
const registry = new Map();

/** @type {Set<string>} Disabled provider IDs. */
const disabledProviders = new Set();

/**
 * Load all providers from subdirectories (images/, papers/, datasets/, general/).
 */
function loadProviders() {
  const dirs = ['images', 'papers', 'datasets', 'general'];

  for (const dir of dirs) {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.provider.js'));

    for (const file of files) {
      try {
        const provider = require(path.join(dirPath, file));
        if (provider && provider.id && typeof provider.scrape === 'function') {
          // Validate required keys availability
          provider._available = checkAvailability(provider);
          registry.set(provider.id, provider);
          log.debug(`Registered provider: ${provider.id} (${provider.type}, priority=${provider.priority}, available=${provider._available})`);
        } else {
          log.warn(`Skipping invalid provider file: ${file}`);
        }
      } catch (err) {
        log.error(`Failed to load provider: ${file}`, { error: err.message });
      }
    }
  }

  log.info(`Loaded ${registry.size} providers`);
}

/**
 * Check if a provider's required API keys are configured.
 * @param {Object} provider
 * @returns {boolean}
 */
function checkAvailability(provider) {
  if (!provider.requiredKeys || provider.requiredKeys.length === 0) return true;

  for (const key of provider.requiredKeys) {
    if (!config.providers[key]) return false;
  }
  return true;
}

/**
 * Get all providers for a specific type, sorted by priority (descending).
 * @param {string} type - 'images', 'papers', 'datasets', 'general'
 * @returns {Object[]} Sorted provider list
 */
function getByType(type) {
  const providers = [];
  for (const provider of registry.values()) {
    if (provider.type === type && !disabledProviders.has(provider.id) && provider._available) {
      providers.push(provider);
    }
  }
  return providers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * Get a specific provider by ID.
 * @param {string} id - Provider ID
 * @returns {Object|null} Provider or null
 */
function getById(id) {
  return registry.get(id) || null;
}

/**
 * Get all registered providers.
 * @returns {Object[]}
 */
function getAll() {
  return Array.from(registry.values());
}

/**
 * Disable a provider by ID.
 * @param {string} id - Provider ID
 */
function disable(id) {
  disabledProviders.add(id);
  log.info(`Provider disabled: ${id}`);
}

/**
 * Enable a previously disabled provider.
 * @param {string} id - Provider ID
 */
function enable(id) {
  disabledProviders.delete(id);
  log.info(`Provider enabled: ${id}`);
}

/**
 * Check if a provider is available and enabled.
 * @param {string} id - Provider ID
 * @returns {boolean}
 */
function isAvailable(id) {
  const provider = registry.get(id);
  if (!provider) return false;
  return provider._available && !disabledProviders.has(id);
}

/**
 * Validate all providers — log their status.
 * @returns {{ total: number, available: number, disabled: number, unavailable: number }}
 */
function validate() {
  let available = 0;
  let disabled = 0;
  let unavailable = 0;

  for (const [id, provider] of registry) {
    if (disabledProviders.has(id)) {
      disabled++;
    } else if (provider._available) {
      available++;
    } else {
      unavailable++;
    }
  }

  const stats = { total: registry.size, available, disabled, unavailable };
  log.info('Provider validation', stats);
  return stats;
}

// Auto-load on first require
loadProviders();

module.exports = {
  getByType,
  getById,
  getAll,
  disable,
  enable,
  isAvailable,
  validate,
  loadProviders,
};

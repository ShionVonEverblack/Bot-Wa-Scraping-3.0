'use strict';

/**
 * @fileoverview i18n service — template-based translation with variable substitution.
 * @module services/i18n/index
 */

const path = require('path');
const locales = require('../../../locales/locales.json');
const { createLogger } = require('../monitor/logger');

const log = createLogger('i18n');

/**
 * Get a translated string.
 * @param {string} key - Translation key (e.g., 'greeting', 'error_generic')
 * @param {string} [lang='id'] - Language code
 * @param {Object} [vars={}] - Template variables
 * @returns {string}
 */
function t(key, lang = 'id', vars = {}) {
  const strings = locales[lang] || locales['id'] || {};
  let text = strings[key];

  if (!text) {
    log.warn(`Missing translation: ${lang}.${key}`);
    text = locales['id']?.[key] || key || '';
  }

  if (typeof text !== 'string') {
    return String(text || '');
  }

  // Substitute variables: {varName}
  if (vars && typeof vars === 'object') {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value == null ? '' : value));
    }
  }

  return text;
}

/**
 * Get all available languages.
 * @returns {string[]}
 */
function availableLanguages() {
  return Object.keys(locales);
}

module.exports = { t, availableLanguages };

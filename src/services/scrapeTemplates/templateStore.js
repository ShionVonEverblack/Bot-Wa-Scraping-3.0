'use strict';

/**
 * @fileoverview Scrape template store — built-in + custom template management.
 * @module services/scrapeTemplates/templateStore
 */

const path = require('path');
const config = require('../../config');
const { writeJson, readJson, ensureDir } = require('../../utils/fsUtil');
const { createLogger } = require('../monitor/logger');
const fs = require('fs');

const log = createLogger('templates');

/**
 * @typedef {Object} ScrapeTemplate
 * @property {string} name - Template name
 * @property {string} description - Template description
 * @property {Object<string, string[]>} selectors - Named CSS selector arrays (fallback order)
 * @property {Object} [pagination] - Pagination config
 * @property {string} [waitFor] - CSS selector to wait for
 */

/** Built-in templates. */
const BUILTIN_TEMPLATES = {
  ecommerce_product: {
    name: 'ecommerce_product',
    description: 'Extract product details from e-commerce pages',
    selectors: {
      title: ['h1.product-title', '#product-name', 'h1[itemprop="name"]', '.product-name h1', 'h1'],
      price: ['.price', '.product-price', '[data-price]', '[itemprop="price"]', '.sale-price', '#price'],
      description: ['.description', '.product-desc', '[itemprop="description"]', '.product-description', '#description'],
      images: ['img.product-image', '.gallery img', '.product-gallery img', '[data-zoom-image]', '.product-images img'],
      rating: ['.rating', '[itemprop="ratingValue"]', '.star-rating', '.review-rating'],
      reviews: ['.review', '.customer-review', '[itemprop="review"]', '.reviews-list .review-item'],
      sku: ['[itemprop="sku"]', '.sku', '#sku', '.product-sku'],
      availability: ['[itemprop="availability"]', '.availability', '.stock-status', '#availability'],
    },
    pagination: { nextButton: '.next-page, .pagination .next, a.next', maxPages: 1 },
    waitFor: 'h1',
  },

  news_article: {
    name: 'news_article',
    description: 'Extract article content from news websites',
    selectors: {
      title: ['h1.article-title', 'h1.entry-title', 'article h1', '.post-title h1', 'h1'],
      author: ['.author-name', '[rel="author"]', '.byline', '.post-author', '[itemprop="author"]'],
      date: ['time[datetime]', '.publish-date', '.post-date', '[itemprop="datePublished"]', '.article-date'],
      content: ['article .content', '.article-body', '.post-content', '.entry-content', 'article p'],
      images: ['article img', '.article-body img', '.post-content img', '.featured-image img'],
      category: ['.category', '.post-category', '[rel="tag"]', '.article-tag'],
    },
    waitFor: 'article, .article-body, .post-content',
  },

  social_profile: {
    name: 'social_profile',
    description: 'Extract profile information from social media pages',
    selectors: {
      name: ['.profile-name', 'h1.name', '.display-name', '[data-testid="profile-name"]'],
      bio: ['.bio', '.profile-bio', '.description', '.about-me'],
      followers: ['.followers-count', '.follower-count', '[data-followers]'],
      following: ['.following-count', '[data-following]'],
      posts: ['.post-count', '.posts-count', '[data-posts]'],
      avatar: ['.avatar img', '.profile-image img', '.profile-pic img'],
      location: ['.location', '.profile-location', '[data-location]'],
    },
    waitFor: '.profile-name, .display-name, h1',
  },
};

/** Custom templates directory. */
const CUSTOM_DIR = path.join(config.dirs.templates || './templates', 'custom');

/**
 * Get a built-in template by name.
 * @param {string} name - Template name
 * @returns {ScrapeTemplate|null}
 */
function getBuiltin(name) {
  return BUILTIN_TEMPLATES[name] || null;
}

/**
 * Get a custom template by name.
 * @param {string} name - Template name
 * @returns {Promise<ScrapeTemplate|null>}
 */
async function getCustom(name) {
  const filePath = path.join(CUSTOM_DIR, `${name}.json`);
  return readJson(filePath);
}

/**
 * Get a template by name (checks built-in first, then custom).
 * @param {string} name - Template name
 * @returns {Promise<ScrapeTemplate|null>}
 */
async function getTemplate(name) {
  const builtin = getBuiltin(name);
  if (builtin) return builtin;
  return getCustom(name);
}

/**
 * Save a custom template.
 * @param {string} name - Template name
 * @param {ScrapeTemplate} template - Template data
 * @returns {Promise<void>}
 */
async function saveTemplate(name, template) {
  await ensureDir(CUSTOM_DIR);
  template.name = name;
  const filePath = path.join(CUSTOM_DIR, `${name}.json`);
  await writeJson(filePath, template);
  log.info(`Template saved: ${name}`);
}

/**
 * List all available templates (built-in + custom).
 * @returns {Promise<Array<{name:string, description:string, type:string}>>}
 */
async function listTemplates() {
  const templates = [];

  // Built-in
  for (const [name, tpl] of Object.entries(BUILTIN_TEMPLATES)) {
    templates.push({ name, description: tpl.description, type: 'builtin' });
  }

  // Custom
  try {
    await ensureDir(CUSTOM_DIR);
    const files = await fs.promises.readdir(CUSTOM_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const tpl = await readJson(path.join(CUSTOM_DIR, file));
        if (tpl) {
          templates.push({
            name: tpl.name || file.replace('.json', ''),
            description: tpl.description || 'Custom template',
            type: 'custom',
          });
        }
      }
    }
  } catch { /* no custom templates yet */ }

  return templates;
}

/**
 * Delete a custom template.
 * @param {string} name - Template name
 * @returns {Promise<boolean>} true if deleted
 */
async function deleteTemplate(name) {
  if (BUILTIN_TEMPLATES[name]) {
    log.warn(`Cannot delete built-in template: ${name}`);
    return false;
  }

  const filePath = path.join(CUSTOM_DIR, `${name}.json`);
  try {
    await fs.promises.unlink(filePath);
    log.info(`Template deleted: ${name}`);
    return true;
  } catch {
    return false;
  }
}

module.exports = { getTemplate, getBuiltin, saveTemplate, listTemplates, deleteTemplate };

'use strict';

/**
 * @fileoverview Adaptive Scraper & Anti-Bot Stealth Engine (inspired by D4Vinci/Scrapling).
 * Provides self-healing DOM element fingerprinting, similarity-based element relocation
 * when website layouts/classes change, and realistic browser stealth header profiles.
 * @module engine/adaptiveScraper
 */

const cheerio = require('cheerio');
const path = require('path');
const config = require('../config');
const { readJson, writeJson, ensureDir } = require('../utils/fsUtil');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('engine:adaptive');

/** In-memory signature registry: key -> ElementSignature. */
const signatureStore = new Map();

/** Browser profiles for stealth header generation. */
const STEALTH_PROFILES = [
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    secChUa: '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    platform: '"Windows"',
  },
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    secChUa: '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    platform: '"macOS"',
  },
  {
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    secChUa: '"Chromium";v="125", "Not.A/Brand";v="24", "Google Chrome";v="125"',
    platform: '"Linux"',
  },
];

/** Semantic attributes worth tracking for adaptive element matching. */
const SEMANTIC_ATTRS = [
  'role',
  'name',
  'type',
  'aria-label',
  'itemprop',
  'data-testid',
  'data-test',
  'data-cy',
  'data-id',
  'title',
  'placeholder',
];

/**
 * Generate realistic stealth HTTP headers for a target URL.
 * @param {string} [targetUrl='']
 * @returns {Object<string, string>}
 */
function getStealthHeaders(targetUrl = '') {
  const profile = STEALTH_PROFILES[Math.floor(Math.random() * STEALTH_PROFILES.length)];
  let referer = 'https://www.google.com/';
  try {
    if (targetUrl) {
      const u = new URL(targetUrl);
      referer = `${u.protocol}//${u.hostname}/`;
    }
  } catch { /* ignore */ }

  return {
    'User-Agent': profile.ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-CH-UA': profile.secChUa,
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': profile.platform,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': referer,
  };
}

/**
 * Tokenize a string into lowercase alphanumeric words/ngrams.
 * @param {string} str
 * @returns {string[]}
 */
function tokenize(str) {
  if (!str || typeof str !== 'string') return [];
  const shapes = [];
  if (/[$€£¥]|rp\b/i.test(str)) shapes.push('__currency__');
  if (/\d+[.,]\d+/.test(str)) shapes.push('__decimal__');

  const rawWords = str
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/[\s_-]+/)
    .filter(t => t.length > 1);

  const expanded = new Set([...shapes, ...rawWords]);
  for (const w of rawWords) {
    if (w.length >= 5 && /^[a-z]+$/.test(w)) {
      expanded.add(w.slice(0, 4));
    }
  }
  return [...expanded];
}

/**
 * Compute Jaccard similarity between two arrays of tokens.
 * @param {string[]} listA
 * @param {string[]} listB
 * @returns {number} Similarity in [0, 1]
 */
function jaccardSimilarity(listA = [], listB = []) {
  if (listA.length === 0 && listB.length === 0) return 1;
  if (listA.length === 0 || listB.length === 0) return 0;

  const setA = new Set(listA);
  const setB = new Set(listB);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Build a CSS path for a Cheerio element.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('domhandler').Element} el
 * @returns {string}
 */
function buildCssPath($, el) {
  const parts = [];
  let curr = el;
  while (curr && curr.type === 'tag' && curr.tagName) {
    const tag = curr.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body') {
      parts.unshift(tag);
      break;
    }
    const id = $(curr).attr('id');
    if (id) {
      parts.unshift(`${tag}#${id}`);
      break;
    }
    const cls = ($(curr).attr('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    parts.unshift(cls.length > 0 ? `${tag}.${cls.join('.')}` : tag);
    curr = curr.parent;
  }
  return parts.join(' > ');
}

/**
 * Build a multi-attribute signature (fingerprint) of a DOM element for Scrapling-style relocation.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('domhandler').Element} el
 * @returns {Object} ElementSignature
 */
function buildElementSignature($, el) {
  const $el = $(el);
  const tag = (el.tagName || '').toLowerCase();
  const id = ($el.attr('id') || '').trim();
  const classes = ($el.attr('class') || '').trim().split(/\s+/).filter(Boolean);

  const attributes = {};
  for (const attr of SEMANTIC_ATTRS) {
    const val = $el.attr(attr);
    if (val) attributes[attr] = val.trim();
  }

  const textSnippet = $el.text().replace(/\s+/g, ' ').trim().slice(0, 200);
  const directText = $el
    .contents()
    .filter((_, n) => n.type === 'text')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  const parent = el.parent && el.parent.type === 'tag' ? el.parent : null;
  const parentTag = parent ? (parent.tagName || '').toLowerCase() : '';
  const parentClasses = parent
    ? ($(parent).attr('class') || '').trim().split(/\s+/).filter(Boolean)
    : [];

  const childTags = [];
  $el.children().each((_, child) => {
    if (child.tagName) childTags.push(child.tagName.toLowerCase());
  });

  let depth = 0;
  let p = el.parent;
  while (p && p.type === 'tag') {
    depth++;
    p = p.parent;
  }

  return {
    tag,
    id,
    classes,
    attributes,
    textSnippet,
    directText,
    parentTag,
    parentClasses,
    childTags: childTags.slice(0, 10),
    depth,
    cssPath: buildCssPath($, el),
  };
}

/**
 * Compute weighted similarity between two element signatures (Scrapling algorithm).
 * @param {Object} sigA - Reference signature
 * @param {Object} sigB - Candidate signature
 * @returns {number} Similarity score between 0 and 1
 */
function computeSignatureSimilarity(sigA, sigB) {
  if (!sigA || !sigB) return 0;

  let score = 0;
  let totalWeight = 0;

  // 1. Tag similarity (weight 0.18)
  const tagWeight = 0.18;
  totalWeight += tagWeight;
  if (sigA.tag && sigB.tag) {
    if (sigA.tag === sigB.tag) {
      score += tagWeight;
    } else if (
      (['div', 'section', 'article', 'main'].includes(sigA.tag) &&
        ['div', 'section', 'article', 'main'].includes(sigB.tag)) ||
      (['span', 'p', 'label', 'a', 'div'].includes(sigA.tag) &&
        ['span', 'p', 'label', 'a', 'div'].includes(sigB.tag)) ||
      (/^h[1-6]$/.test(sigA.tag) && /^h[1-6]$/.test(sigB.tag))
    ) {
      score += tagWeight * 0.55;
    }
  }

  // 2. ID & Semantic Attributes similarity (weight 0.32)
  const attrKeysA = Object.keys(sigA.attributes || {});
  const attrKeysB = Object.keys(sigB.attributes || {});
  if (sigA.id || sigB.id || attrKeysA.length > 0 || attrKeysB.length > 0) {
    const attrWeight = 0.32;
    totalWeight += attrWeight;
    let attrMatches = 0;
    let attrChecks = 0;

    if (sigA.id || sigB.id) {
      attrChecks++;
      if (sigA.id && sigB.id) {
        if (sigA.id === sigB.id) attrMatches += 1;
        else attrMatches += jaccardSimilarity(tokenize(sigA.id), tokenize(sigB.id));
      }
    }

    const allKeys = new Set([...attrKeysA, ...attrKeysB]);
    for (const k of allKeys) {
      attrChecks++;
      const vA = sigA.attributes?.[k];
      const vB = sigB.attributes?.[k];
      if (vA && vB) {
        if (vA === vB) attrMatches += 1;
        else attrMatches += jaccardSimilarity(tokenize(vA), tokenize(vB));
      }
    }

    if (attrChecks > 0) {
      score += attrWeight * (attrMatches / attrChecks);
    }
  }

  // 3. Class tokens similarity (weight 0.18)
  if ((sigA.classes && sigA.classes.length > 0) || (sigB.classes && sigB.classes.length > 0)) {
    const classWeight = 0.18;
    totalWeight += classWeight;
    const tokensA = tokenize((sigA.classes || []).join(' '));
    const tokensB = tokenize((sigB.classes || []).join(' '));
    score += classWeight * jaccardSimilarity(tokensA, tokensB);
  }

  // 4. Text content similarity (weight 0.20)
  if (sigA.textSnippet || sigB.textSnippet) {
    const textWeight = 0.20;
    totalWeight += textWeight;
    const textSim = jaccardSimilarity(
      tokenize(sigA.directText || sigA.textSnippet),
      tokenize(sigB.directText || sigB.textSnippet)
    );
    score += textWeight * textSim;
  }

  // 5. Structural context similarity (parent tag, child tags, depth) (weight 0.12)
  const structWeight = 0.12;
  totalWeight += structWeight;
  let structScore = 0;
  if (sigA.parentTag && sigA.parentTag === sigB.parentTag) {
    structScore += 0.4;
  } else if (
    ['div', 'section', 'article', 'main'].includes(sigA.parentTag) &&
    ['div', 'section', 'article', 'main'].includes(sigB.parentTag)
  ) {
    structScore += 0.25;
  }
  if ((sigA.childTags?.length || 0) > 0 || (sigB.childTags?.length || 0) > 0) {
    structScore += 0.35 * jaccardSimilarity(sigA.childTags || [], sigB.childTags || []);
  } else {
    structScore += 0.35;
  }
  const depthDiff = Math.abs((sigA.depth || 0) - (sigB.depth || 0));
  structScore += 0.25 * Math.max(0, 1 - depthDiff / 6);
  score += structWeight * structScore;

  return totalWeight > 0 ? Number((score / totalWeight).toFixed(4)) : 0;
}

/**
 * Relocate the best-matching element in a Cheerio DOM using a saved signature.
 * @param {import('cheerio').CheerioAPI} $
 * @param {Object} signature - Target ElementSignature
 * @param {number} [threshold=0.45] - Minimum similarity score to accept
 * @returns {{
 *   found: boolean,
 *   score: number,
 *   element: import('domhandler').Element|null,
 *   text: string,
 *   attributes: Object,
 *   cssPath: string
 * }}
 */
function relocateElement($, signature, threshold = config.crawler?.adaptiveThreshold || 0.45) {
  if (!signature || typeof $ !== 'function') {
    return { found: false, score: 0, element: null, text: '', attributes: {}, cssPath: '' };
  }

  let bestEl = null;
  let bestSig = null;
  let bestScore = 0;

  $('body *').each((_, el) => {
    if (el.type !== 'tag') return;
    const tag = (el.tagName || '').toLowerCase();
    if (['script', 'style', 'noscript', 'svg', 'path', 'meta', 'link'].includes(tag)) return;

    const candSig = buildElementSignature($, el);
    const sim = computeSignatureSimilarity(signature, candSig);
    if (sim > bestScore) {
      bestScore = sim;
      bestEl = el;
      bestSig = candSig;
    }
  });

  if (!bestEl || bestScore < threshold) {
    return {
      found: false,
      score: bestScore,
      element: null,
      text: '',
      attributes: {},
      cssPath: '',
    };
  }

  const $best = $(bestEl);
  return {
    found: true,
    score: bestScore,
    element: bestEl,
    text: $best.text().replace(/\s+/g, ' ').trim(),
    attributes: bestSig.attributes,
    cssPath: bestSig.cssPath,
  };
}

const fs = require('fs');

/** Serialized write queue to prevent concurrent read-modify-write races. */
let signatureWriteChain = Promise.resolve();

/**
 * Save or retrieve adaptive signatures on disk (optional persistence).
 * @param {string} key
 * @param {Object} [sig]
 * @returns {Promise<Object|null>}
 */
async function syncSignature(key, sig) {
  const filePath = path.join(config.dirs.cache || './cache', 'adaptive_signatures.json');
  if (sig) {
    signatureStore.set(key, sig);
    signatureWriteChain = signatureWriteChain
      .then(async () => {
        try {
          await ensureDir(config.dirs.cache || './cache');
          const existing = (await readJson(filePath)) || {};
          for (const [k, v] of signatureStore.entries()) {
            existing[k] = v;
          }
          existing[key] = sig;
          await writeJson(filePath, existing);
        } catch { /* ignore disk error */ }
      })
      .catch(() => {});
    await signatureWriteChain;
    return sig;
  }

  if (signatureStore.has(key)) {
    return signatureStore.get(key);
  }
  try {
    const existing = await readJson(filePath);
    if (existing && existing[key]) {
      signatureStore.set(key, existing[key]);
      return existing[key];
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Perform adaptive extraction on HTML content.
 * - First attempts standard CSS `selector`.
 * - If found and `adaptiveKey` is provided, learns & stores the element signature.
 * - If `selector` finds 0 matches (e.g., site layout changed), falls back to relocating
 *   the element via stored signature or `fallbackSignature`.
 *
 * @param {string} html - Raw HTML
 * @param {Object} options
 * @param {string} [options.selector] - CSS selector
 * @param {string} [options.adaptiveKey] - Key for saving/loading element signature
 * @param {Object} [options.fallbackSignature] - Explicit signature for relocation
 * @param {number} [options.threshold=0.45] - Minimum similarity threshold
 * @returns {Promise<{
 *   mode: 'selector'|'adaptive-relocated'|'none',
 *   items: string[],
 *   signature: Object|null,
 *   similarityScore: number,
 *   matchedSelector: string
 * }>}
 */
async function adaptiveExtract(html, options = {}) {
  const {
    selector,
    adaptiveKey,
    fallbackSignature,
    threshold = config.crawler?.adaptiveThreshold || 0.45,
  } = options;

  if (!html || typeof html !== 'string') {
    return { mode: 'none', items: [], signature: null, similarityScore: 0, matchedSelector: '' };
  }

  const $ = cheerio.load(html);

  // 1. Try primary CSS selector
  if (selector) {
    const matched = $(selector);
    if (matched.length > 0) {
      const items = [];
      matched.each((_, el) => {
        const txt = $(el).text().replace(/\s+/g, ' ').trim();
        if (txt) items.push(txt);
      });

      const firstSig = buildElementSignature($, matched[0]);
      if (adaptiveKey) {
        await syncSignature(adaptiveKey, firstSig);
      }

      return {
        mode: 'selector',
        items,
        signature: firstSig,
        similarityScore: 1.0,
        matchedSelector: selector,
      };
    }
  }

  // 2. Selector failed or omitted — attempt Scrapling-style adaptive relocation!
  const sigToUse = fallbackSignature || (adaptiveKey ? await syncSignature(adaptiveKey) : null);
  if (sigToUse) {
    const relocated = relocateElement($, sigToUse, threshold);
    if (relocated.found && relocated.text) {
      const healedSig = buildElementSignature($, relocated.element);
      log.info(`Adaptive relocation succeeded (score=${relocated.score}, path=${relocated.cssPath})`);
      return {
        mode: 'adaptive-relocated',
        items: [relocated.text],
        signature: healedSig,
        similarityScore: relocated.score,
        matchedSelector: relocated.cssPath,
      };
    }
  }

  return {
    mode: 'none',
    items: [],
    signature: null,
    similarityScore: 0,
    matchedSelector: '',
  };
}

/**
 * Clear in-memory and on-disk adaptive signatures.
 */
function clearSignatures() {
  signatureStore.clear();
  try {
    const filePath = path.join(config.dirs.cache || './cache', 'adaptive_signatures.json');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch { /* ignore */ }
}

module.exports = {
  getStealthHeaders,
  buildElementSignature,
  computeSignatureSimilarity,
  relocateElement,
  adaptiveExtract,
  clearSignatures,
  jaccardSimilarity,
  tokenize,
};

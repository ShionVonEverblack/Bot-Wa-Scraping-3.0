'use strict';

/**
 * @fileoverview LLM-Ready Web Crawler & Markdown Extractor.
 * Inspired by Firecrawl, Crawl4AI, and Agent-Reach.
 * Converts raw HTML / web pages into clean Markdown, Fit-Markdown (boilerplate-pruned),
 * structured metadata, GFM tables, and numbered link citations.
 * Includes optional bridges to Firecrawl API and Jina Reader (r.jina.ai).
 * @module engine/llmCrawler
 */

const cheerio = require('cheerio');
const config = require('../config');
const httpClient = require('../utils/httpClient');
const { createLogger } = require('../services/monitor/logger');

const log = createLogger('engine:llm-crawler');

/** Selectors that are always removed as noise/boilerplate. */
const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'canvas',
  'iframe',
  'template',
  'form[role="search"]',
  '[aria-hidden="true"]',
  '[hidden]',
  '.sr-only',
];

/** Selectors removed when pruning boilerplate for Fit-Markdown (Crawl4AI style). */
const BOILERPLATE_SELECTORS = [
  'nav',
  'body > footer',
  'body > header',
  'footer:not(article footer):not(main footer)',
  'header:not(article header):not(main header)',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '.navbar',
  '.nav',
  '.menu',
  '.sidebar',
  '.footer',
  '.header',
  '.breadcrumb',
  '.breadcrumbs',
  '.cookie',
  '.cookie-banner',
  '.cookie-consent',
  '.ads',
  '.ad',
  '.advertisement',
  '.promo',
  '.popup',
  '.modal',
  '.newsletter',
  '.share-buttons',
  '.social-share',
  '.related-posts',
  '#sidebar',
  '#footer',
  '#header',
  '#nav',
];

/**
 * Resolve a potentially relative URL against a base URL.
 * Rejects non-navigational schemes (javascript:, mailto:, tel:, data:, vbscript:, blob:) and pure fragments.
 * @param {string} href
 * @param {string} [baseUrl]
 * @returns {string}
 */
function resolveUrl(href, baseUrl) {
  if (!href || typeof href !== 'string') return '';
  const trimmed = href.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    /^(?:javascript|mailto|tel|vbscript|data|blob|about):/i.test(trimmed)
  ) {
    return '';
  }
  if (!baseUrl) {
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        return new URL(trimmed).href;
      } catch {
        return '';
      }
    }
    return trimmed;
  }
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (!/^https?:$/i.test(resolved.protocol)) return '';
    return resolved.href;
  } catch {
    return '';
  }
}

/**
 * Extract rich page metadata from a Cheerio root instance.
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} [baseUrl]
 * @returns {Object}
 */
function extractMetadata($, baseUrl = '') {
  const title =
    ($('meta[property="og:title"]').attr('content') || '').trim() ||
    ($('title').first().text() || '').trim() ||
    ($('h1').first().text() || '').trim();

  const description =
    ($('meta[name="description"]').attr('content') || '').trim() ||
    ($('meta[property="og:description"]').attr('content') || '').trim() ||
    ($('meta[name="twitter:description"]').attr('content') || '').trim();

  const author =
    ($('meta[name="author"]').attr('content') || '').trim() ||
    ($('meta[property="article:author"]').attr('content') || '').trim();

  const publishedTime =
    ($('meta[property="article:published_time"]').attr('content') || '').trim() ||
    ($('time[datetime]').first().attr('datetime') || '').trim();

  const siteName = ($('meta[property="og:site_name"]').attr('content') || '').trim();
  const canonicalUrl = resolveUrl($('link[rel="canonical"]').attr('href') || '', baseUrl) || baseUrl;

  let jsonLd = null;
  const ldScript = $('script[type="application/ld+json"]').first().html();
  if (ldScript) {
    try {
      jsonLd = JSON.parse(ldScript);
    } catch { /* ignore malformed JSON-LD */ }
  }

  return {
    title,
    description,
    author,
    publishedTime,
    siteName,
    canonicalUrl,
    jsonLd,
  };
}

/**
 * Convert a Cheerio `<table>` element into a GitHub-Flavored Markdown table.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('domhandler').Element} tableEl
 * @returns {string}
 */
function tableToMarkdown($, tableEl) {
  const rows = [];
  $(tableEl).find('tr').each((_, tr) => {
    const cells = [];
    $(tr).find('th, td').each((__, cell) => {
      const text = $(cell).text().replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
      cells.push(text);
    });
    if (cells.length > 0 && cells.some(Boolean)) {
      rows.push(cells);
    }
  });

  if (rows.length === 0) return '';

  const colCount = Math.max(...rows.map(r => r.length));
  const normalizeRow = (r) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push('');
    return `| ${padded.join(' | ')} |`;
  };

  const headerLine = normalizeRow(rows[0]);
  const separatorLine = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const bodyLines = rows.slice(1).map(normalizeRow);

  return ['\n', headerLine, separatorLine, ...bodyLines, '\n'].join('\n');
}

/**
 * Convert a DOM subtree into clean Markdown.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} root
 * @param {Object} [options]
 * @param {string} [options.baseUrl='']
 * @param {boolean} [options.includeLinks=true]
 * @param {boolean} [options.includeImages=true]
 * @param {Array<{index: number, text: string, url: string}>} [citations]
 * @returns {string}
 */
function domToMarkdown($, root, options = {}, citations = []) {
  const {
    baseUrl = '',
    includeLinks = true,
    includeImages = true,
  } = options;

  const citationMap = new Map();

  function recordCitation(url, text) {
    if (!url) return null;
    if (citationMap.has(url)) return citationMap.get(url);
    const idx = citations.length + 1;
    citations.push({ index: idx, text: text || url, url });
    citationMap.set(url, idx);
    return idx;
  }

  function renderInline(node) {
    if (node.type === 'text') {
      return (node.data || '').replace(/\s+/g, ' ');
    }
    if (node.type !== 'tag') return '';

    const tag = (node.tagName || '').toLowerCase();
    const $el = $(node);

    if (tag === 'br') return '\n';
    if (tag === 'code') {
      const txt = $el.text().trim();
      return txt ? `\`${txt}\`` : '';
    }
    if (tag === 'strong' || tag === 'b') {
      const inner = renderChildren(node).trim();
      return inner ? `**${inner}**` : '';
    }
    if (tag === 'em' || tag === 'i') {
      const inner = renderChildren(node).trim();
      return inner ? `*${inner}*` : '';
    }
    if (tag === 'a') {
      const text = renderChildren(node).trim() || $el.text().trim();
      const rawHref = $el.attr('href') || '';
      const resolved = resolveUrl(rawHref, baseUrl);
      if (!resolved || !includeLinks) return text;
      recordCitation(resolved, text);
      return text ? `[${text}](${resolved})` : resolved;
    }
    if (tag === 'img') {
      if (!includeImages) return '';
      const rawSrc = ($el.attr('src') || $el.attr('data-src') || '').trim();
      if (!rawSrc || /^data:/i.test(rawSrc) || rawSrc.includes('1x1')) return '';
      const resolved = resolveUrl(rawSrc, baseUrl);
      if (!resolved || /^data:/i.test(resolved) || resolved.includes('1x1')) return '';
      const alt = ($el.attr('alt') || 'image').trim();
      return `![${alt}](${resolved})`;
    }

    return renderChildren(node);
  }

  function renderChildren(parent) {
    if (!parent || !parent.children) return '';
    return parent.children.map(child => renderNode(child)).join('');
  }

  function renderNode(node) {
    if (!node) return '';
    if (node.type === 'text') {
      return (node.data || '').replace(/[ \t]+/g, ' ');
    }
    if (node.type !== 'tag') return '';

    const tag = (node.tagName || '').toLowerCase();
    const $el = $(node);

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag.charAt(1), 10);
      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (!text) return '';
      return `\n\n${'#'.repeat(level)} ${text}\n\n`;
    }

    // Paragraphs
    if (tag === 'p') {
      const content = (node.children || []).map(renderInline).join('').replace(/[ \t]+/g, ' ').trim();
      return content ? `\n\n${content}\n\n` : '';
    }

    // Preformatted code blocks
    if (tag === 'pre') {
      const codeEl = $el.find('code').first();
      const classAttr = (codeEl.attr('class') || $el.attr('class') || '');
      const langMatch = classAttr.match(/language-([a-zA-Z0-9_-]+)/);
      const lang = langMatch ? langMatch[1] : '';
      const codeText = (codeEl.length ? codeEl.text() : $el.text()).replace(/\r\n/g, '\n').trim();
      return codeText ? `\n\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n` : '';
    }

    // Blockquotes
    if (tag === 'blockquote') {
      const inner = (node.children || []).map(renderInline).join('').replace(/\s+/g, ' ').trim() ||
        $el.text().replace(/\s+/g, ' ').trim();
      if (!inner) return '';
      const quoted = inner.split('\n').map(l => `> ${l.trim()}`).join('\n');
      return `\n\n${quoted}\n\n`;
    }

    // Lists
    if (tag === 'ul' || tag === 'ol') {
      const isOrdered = tag === 'ol';
      const items = [];
      $el.children('li').each((idx, li) => {
        const inlineParts = [];
        const nestedLists = [];
        for (const child of li.children || []) {
          const childTag = child.tagName ? child.tagName.toLowerCase() : '';
          if (childTag === 'ul' || childTag === 'ol') {
            const subList = renderNode(child).trim();
            if (subList) {
              nestedLists.push(subList.split('\n').map(l => `  ${l}`).join('\n'));
            }
          } else {
            inlineParts.push(renderInline(child));
          }
        }
        const itemText = inlineParts.join('').replace(/\s+/g, ' ').trim() || $(li).text().replace(/\s+/g, ' ').trim();
        if (itemText) {
          const bullet = isOrdered ? `${idx + 1}.` : '-';
          items.push(`${bullet} ${itemText}`);
        }
        if (nestedLists.length > 0) {
          items.push(...nestedLists);
        }
      });
      return items.length > 0 ? `\n\n${items.join('\n')}\n\n` : '';
    }

    // Tables
    if (tag === 'table') {
      return tableToMarkdown($, node);
    }

    // Horizontal rule
    if (tag === 'hr') {
      return '\n\n---\n\n';
    }

    // Inline elements when encountered directly
    if (['a', 'strong', 'b', 'em', 'i', 'code', 'img', 'span', 'small', 'mark', 'sub', 'sup'].includes(tag)) {
      return renderInline(node);
    }

    // Block containers (div, section, article, main, li, etc.)
    const inner = renderChildren(node);
    if (['div', 'section', 'article', 'main', 'header', 'footer', 'figure', 'figcaption'].includes(tag)) {
      return `\n${inner}\n`;
    }

    return inner;
  }

  const rawMd = renderChildren(root[0] || root);
  return rawMd
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Find the highest text-density main content container (Crawl4AI Fit-Markdown heuristic).
 * @param {import('cheerio').CheerioAPI} $
 * @returns {import('cheerio').Cheerio<any>}
 */
function findMainContentContainer($) {
  const prioritySelectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.markdown-body',
    '#content',
    '.content',
  ];

  for (const sel of prioritySelectors) {
    const candidate = $(sel).first();
    if (candidate.length && candidate.text().trim().length >= 120) {
      return candidate;
    }
  }

  // Fallback: score block containers by text length vs link density
  let bestEl = $('body');
  let bestScore = 0;

  $('div, section, td').each((_, el) => {
    const $el = $(el);
    const textLen = $el.text().replace(/\s+/g, ' ').trim().length;
    if (textLen < 120) return;

    const pCount = $el.find('p').length;
    const linkTextLen = $el.find('a').text().trim().length;
    const linkDensity = textLen > 0 ? linkTextLen / textLen : 1;

    // Penalize high link-density navigation blocks
    const score = (textLen + pCount * 80) * Math.max(0.1, 1 - linkDensity);
    if (score > bestScore) {
      bestScore = score;
      bestEl = $el;
    }
  });

  return bestEl.length ? bestEl : $.root();
}

/**
 * Convert raw HTML into LLM-ready Markdown, Fit-Markdown, metadata, and citations.
 * @param {string} html - Raw HTML string
 * @param {Object} [options]
 * @param {string} [options.url=''] - Source URL for resolving relative links
 * @param {boolean} [options.includeLinks=true]
 * @param {boolean} [options.includeImages=true]
 * @param {boolean} [options.includeCitations=true]
 * @returns {{
 *   url: string,
 *   title: string,
 *   description: string,
 *   metadata: Object,
 *   markdown: string,
 *   fitMarkdown: string,
 *   citations: Array<{index: number, text: string, url: string}>,
 *   links: Array<{text: string, url: string, isExternal: boolean}>,
 *   images: Array<{alt: string, url: string}>,
 *   wordCount: number,
 *   readingTimeMinutes: number
 * }}
 */
function htmlToMarkdown(html, options = {}) {
  if (!html || typeof html !== 'string') {
    return {
      url: options.url || '',
      title: '',
      description: '',
      metadata: {},
      markdown: '',
      fitMarkdown: '',
      citations: [],
      links: [],
      images: [],
      wordCount: 0,
      readingTimeMinutes: 0,
    };
  }

  const baseUrl = options.url || '';
  const $ = cheerio.load(html);

  // Extract metadata before stripping tags
  const metadata = extractMetadata($, baseUrl);

  // Remove script/style/noise tags
  $(NOISE_SELECTORS.join(', ')).remove();

  // Collect links and images
  const links = [];
  const seenLinks = new Set();
  let baseHost = '';
  try {
    if (baseUrl) baseHost = new URL(baseUrl).hostname;
  } catch { /* ignore */ }

  $('a[href]').each((_, a) => {
    const resolved = resolveUrl($(a).attr('href'), baseUrl);
    if (!resolved || seenLinks.has(resolved)) return;
    seenLinks.add(resolved);
    let isExternal = false;
    try {
      if (baseHost) isExternal = new URL(resolved).hostname !== baseHost;
    } catch { /* ignore */ }
    links.push({
      text: $(a).text().replace(/\s+/g, ' ').trim().slice(0, 150),
      url: resolved,
      isExternal,
    });
  });

  const images = [];
  const seenImages = new Set();
  $('img').each((_, img) => {
    const rawSrc = ($(img).attr('src') || $(img).attr('data-src') || '').trim();
    if (!rawSrc || /^data:/i.test(rawSrc) || rawSrc.includes('1x1')) return;
    const resolved = resolveUrl(rawSrc, baseUrl);
    if (!resolved || seenImages.has(resolved) || /^data:/i.test(resolved) || resolved.includes('1x1')) return;
    seenImages.add(resolved);
    images.push({
      alt: ($(img).attr('alt') || '').trim(),
      url: resolved,
    });
  });

  // 1. Full Markdown (with noise removed)
  const fullCitations = [];
  const bodyRoot = $('body').length ? $('body') : $.root();
  let markdown = domToMarkdown($, bodyRoot, { ...options, baseUrl }, fullCitations);

  // 2. Fit-Markdown (with boilerplate nav/footer/sidebar/ads removed + main content container)
  const $fit = cheerio.load($.html());
  $fit(BOILERPLATE_SELECTORS.join(', ')).remove();
  const mainContainer = findMainContentContainer($fit);
  const fitCitations = [];
  let fitMarkdown = domToMarkdown($fit, mainContainer, { ...options, baseUrl }, fitCitations);

  if (!fitMarkdown || fitMarkdown.length < 40) {
    fitMarkdown = markdown;
  }

  // Append citation references footer if requested
  const activeCitations = fitCitations.length > 0 ? fitCitations : fullCitations;
  if (options.includeCitations !== false && activeCitations.length > 0) {
    const refLines = activeCitations
      .slice(0, 30)
      .map(c => `[${c.index}]: ${c.url} "${(c.text || '').replace(/"/g, "'")}"`);
    fitMarkdown = `${fitMarkdown}\n\n### References\n${refLines.join('\n')}`;
  }

  const words = fitMarkdown ? fitMarkdown.split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    url: baseUrl,
    title: metadata.title || '',
    description: metadata.description || '',
    metadata,
    markdown,
    fitMarkdown,
    citations: activeCitations,
    links,
    images,
    wordCount: words,
    readingTimeMinutes,
  };
}

/**
 * Scrape a single URL into LLM-ready Markdown & structured metadata.
 * Supports optional Firecrawl API bridge, Crawl4AI API bridge, Jina Reader (`r.jina.ai`),
 * and Defuddle Reader (`defuddle.md`) with native Node.js fallback.
 * @param {string} url
 * @param {Object} [options]
 * @param {'native'|'firecrawl'|'crawl4ai'|'jina'|'defuddle'} [options.bridge]
 * @param {boolean} [options.includeCitations=true]
 * @param {number} [options.timeout=25000]
 * @returns {Promise<Object>}
 */
async function scrapeUrlToMarkdown(url, options = {}) {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const firecrawlKey = options.firecrawlApiKey || config.crawler?.firecrawlApiKey;
  const crawl4aiUrl = options.crawl4aiBaseUrl || config.crawler?.crawl4aiBaseUrl;
  const bridge = options.bridge || (
    firecrawlKey ? 'firecrawl' :
    crawl4aiUrl ? 'crawl4ai' :
    config.crawler?.useJinaReader ? 'jina' :
    config.crawler?.useDefuddle ? 'defuddle' : 'native'
  );

  // 1. Optional Firecrawl API Bridge
  if (bridge === 'firecrawl' && firecrawlKey) {
    try {
      const endpoint = `${options.firecrawlBaseUrl || config.crawler?.firecrawlBaseUrl || 'https://api.firecrawl.dev/v1'}/scrape`;
      const resp = await httpClient.post(
        endpoint,
        { url, formats: ['markdown', 'links'] },
        {
          headers: { Authorization: `Bearer ${firecrawlKey}` },
          timeout: options.timeout || 25000,
          maxRetries: 1,
        }
      );
      if (resp.data?.success && resp.data?.data?.markdown) {
        const fcData = resp.data.data;
        const md = fcData.markdown;
        const wordCount = md.split(/\s+/).filter(Boolean).length;
        return {
          url,
          title: fcData.metadata?.title || url,
          description: fcData.metadata?.description || '',
          metadata: fcData.metadata || {},
          markdown: md,
          fitMarkdown: fcData.fitMarkdown || md,
          citations: [],
          links: (fcData.links || []).map(l => ({ text: l, url: l, isExternal: false })),
          images: [],
          wordCount,
          readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
          bridgeUsed: 'firecrawl',
        };
      }
    } catch (err) {
      log.warn(`Firecrawl bridge failed for ${url}, falling back to native crawler`, { error: err.message });
    }
  }

  // 2. Optional Crawl4AI REST Bridge (unclecode/crawl4ai)
  if (bridge === 'crawl4ai' && crawl4aiUrl) {
    try {
      const endpoint = `${crawl4aiUrl.replace(/\/+$/, '')}/crawl`;
      const headers = {};
      if (options.crawl4aiApiKey || config.crawler?.crawl4aiApiKey) {
        headers.Authorization = `Bearer ${options.crawl4aiApiKey || config.crawler.crawl4aiApiKey}`;
      }
      const resp = await httpClient.post(
        endpoint,
        { urls: [url], word_count_threshold: 10 },
        { headers, timeout: options.timeout || 25000, maxRetries: 1 }
      );
      const resItem = Array.isArray(resp.data?.results) ? resp.data.results[0] : resp.data;
      const rawMd = resItem?.markdown?.raw_markdown || resItem?.markdown_v2?.raw_markdown || (typeof resItem?.markdown === 'string' ? resItem.markdown : '');
      const fitMd = resItem?.markdown?.fit_markdown || resItem?.markdown_v2?.fit_markdown || resItem?.fit_markdown || rawMd;
      if (rawMd || fitMd) {
        const md = rawMd || fitMd;
        const wordCount = (fitMd || md).split(/\s+/).filter(Boolean).length;
        return {
          url,
          title: resItem?.metadata?.title || url,
          description: resItem?.metadata?.description || '',
          metadata: resItem?.metadata || {},
          markdown: md,
          fitMarkdown: fitMd || md,
          citations: [],
          links: (resItem?.links?.internal || []).map(l => ({
            text: l.text || l.href || '',
            url: l.href || l,
            isExternal: false,
          })),
          images: [],
          wordCount,
          readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
          bridgeUsed: 'crawl4ai',
        };
      }
    } catch (err) {
      log.warn(`Crawl4AI bridge failed for ${url}, falling back to native crawler`, { error: err.message });
    }
  }

  // 3. Optional Jina Reader Bridge (Agent-Reach zero-config reader)
  if (bridge === 'jina') {
    try {
      const jinaUrl = `https://r.jina.ai/${url}`;
      const resp = await httpClient.get(jinaUrl, {
        headers: {
          Accept: 'text/plain',
          'X-Return-Format': 'markdown',
        },
        timeout: options.timeout || 20000,
        maxRetries: 1,
      });
      const md = String(resp.data || '').trim();
      if (md.length > 50) {
        const titleMatch = md.match(/^Title:\s*(.+)$/m) || md.match(/^#\s+(.+)$/m);
        const wordCount = md.split(/\s+/).filter(Boolean).length;
        return {
          url,
          title: titleMatch ? titleMatch[1].trim() : url,
          description: md.slice(0, 200),
          metadata: { source: 'r.jina.ai' },
          markdown: md,
          fitMarkdown: md,
          citations: [],
          links: [],
          images: [],
          wordCount,
          readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
          bridgeUsed: 'jina',
        };
      }
    } catch (err) {
      log.warn(`Jina Reader bridge failed for ${url}, falling back to native crawler`, { error: err.message });
    }
  }

  // 4. Optional Defuddle Reader Bridge (Agent-Reach zero-config reader: defuddle.md)
  if (bridge === 'defuddle') {
    try {
      const defuddleUrl = `https://defuddle.md/${url.replace(/^https?:\/\//i, '')}`;
      const resp = await httpClient.get(defuddleUrl, {
        headers: { Accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.8' },
        timeout: options.timeout || 20000,
        maxRetries: 1,
      });
      const md = String(resp.data || '').trim();
      if (md.length > 50) {
        const titleMatch = md.match(/^#\s+(.+)$/m) || md.match(/^title:\s*(.+)$/im);
        const wordCount = md.split(/\s+/).filter(Boolean).length;
        return {
          url,
          title: titleMatch ? titleMatch[1].trim() : url,
          description: md.slice(0, 200),
          metadata: { source: 'defuddle.md' },
          markdown: md,
          fitMarkdown: md,
          citations: [],
          links: [],
          images: [],
          wordCount,
          readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
          bridgeUsed: 'defuddle',
        };
      }
    } catch (err) {
      log.warn(`Defuddle Reader bridge failed for ${url}, falling back to native crawler`, { error: err.message });
    }
  }

  // 5. Native Node.js HTTP + Adaptive Stealth Headers + HTML-to-Markdown
  const { getStealthHeaders } = require('./adaptiveScraper');
  const response = await httpClient.get(url, {
    headers: getStealthHeaders(url),
    timeout: options.timeout || 25000,
    maxRetries: 2,
  });

  const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const parsed = htmlToMarkdown(html, { ...options, url });
  return {
    ...parsed,
    bridgeUsed: 'native',
  };
}

/**
 * Normalize a URL for crawl deduplication (strip hash, normalize host/trailing slash).
 * @param {string} rawUrl
 * @returns {string}
 */
function normalizeCrawlUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    const pathname = u.pathname.replace(/\/+$/, '') || '';
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${pathname}${u.search}`;
  } catch {
    return String(rawUrl || '').replace(/#.*$/, '').replace(/\/+$/, '');
  }
}

/**
 * Multi-page BFS crawler (Firecrawl / Crawl4AI style).
 * Crawls internal links starting from `startUrl` up to `maxPages` and `maxDepth`.
 * @param {string} startUrl
 * @param {Object} [options]
 * @param {number} [options.maxPages]
 * @param {number} [options.maxDepth]
 * @param {boolean} [options.allowExternal=false]
 * @param {(url: string, opts: Object) => Promise<Object>} [options.fetcher] - Optional custom fetcher for testing
 * @returns {Promise<{
 *   startUrl: string,
 *   pagesVisited: number,
 *   pages: Object[],
 *   combinedMarkdown: string
 * }>}
 */
async function crawlSite(startUrl, options = {}) {
  if (!startUrl || !/^https?:\/\//i.test(startUrl)) {
    throw new Error(`Invalid URL: ${startUrl}`);
  }
  let baseHost;
  try {
    baseHost = new URL(startUrl).hostname;
  } catch {
    throw new Error(`Invalid URL: ${startUrl}`);
  }

  const maxPages = Math.min(options.maxPages || config.crawler?.maxCrawlPages || 5, 25);
  const maxDepth = Math.min(options.maxDepth ?? config.crawler?.maxCrawlDepth ?? 2, 5);
  const allowExternal = !!options.allowExternal;
  const fetcher = options.fetcher || scrapeUrlToMarkdown;

  const visited = new Set();
  const queue = [{ url: startUrl, depth: 0 }];
  const pages = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const { url, depth } = queue.shift();
    const normalized = normalizeCrawlUrl(url);
    if (!normalized || visited.has(normalized)) continue;
    visited.add(normalized);

    try {
      const pageDoc = await fetcher(url, options);
      if (pageDoc?.url) {
        const finalNormalized = normalizeCrawlUrl(pageDoc.url);
        if (finalNormalized && finalNormalized !== normalized) {
          if (visited.has(finalNormalized)) continue;
          visited.add(finalNormalized);
        }
      }
      pages.push({ ...pageDoc, depth });

      if (depth < maxDepth && Array.isArray(pageDoc.links)) {
        for (const link of pageDoc.links) {
          if (!link.url || !/^https?:\/\//i.test(link.url)) continue;
          let linkUrlObj;
          try {
            linkUrlObj = new URL(link.url);
          } catch {
            continue;
          }
          if (!allowExternal && linkUrlObj.hostname !== baseHost) continue;
          const normLink = normalizeCrawlUrl(link.url);
          if (normLink && !visited.has(normLink)) {
            queue.push({ url: link.url, depth: depth + 1 });
          }
        }
      }
    } catch (err) {
      log.warn(`Crawl failed on ${url}`, { error: err.message });
    }
  }

  const combinedMarkdown = pages
    .map((p, i) => `## [${i + 1}] ${p.title || p.url}\nSource: ${p.url}\n\n${p.fitMarkdown || p.markdown}`)
    .join('\n\n---\n\n');

  return {
    startUrl,
    pagesVisited: pages.length,
    pages,
    combinedMarkdown,
  };
}

module.exports = {
  htmlToMarkdown,
  scrapeUrlToMarkdown,
  crawlSite,
  resolveUrl,
  extractMetadata,
  tableToMarkdown,
  normalizeCrawlUrl,
};

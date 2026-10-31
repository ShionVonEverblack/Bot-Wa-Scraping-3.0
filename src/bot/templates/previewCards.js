'use strict';

/**
 * @fileoverview Preview card templates — formatted result previews for WhatsApp.
 * Supports all 7 data provider categories (images, papers, datasets, code, books, forums, general)
 * with WhatsApp-optimized link preview unfurling (primary URL on line 2).
 * @module bot/templates/previewCards
 */

const { truncate } = require('../../utils/text');

/**
 * Helper to build the preview card header with primary URL for WhatsApp unfurling.
 * @param {string} title
 * @param {Object[]} items
 * @param {Object} [meta]
 * @returns {string}
 */
function buildHeader(title, items, meta = {}) {
  const countStr = items.length > 0 ? ` (${items.length} hasil${meta.provider ? ` · via ${meta.provider}` : ''})` : '';
  let text = `${title}${countStr}\n`;
  const firstUrl = items[0]?.url || items[0]?.sourceUrl || items[0]?.downloadUrl;
  if (firstUrl) {
    text += `🔗 ${firstUrl}\n`;
  }
  text += '\n';
  return text;
}

/**
 * Format image results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @param {Object} [meta]
 * @returns {string}
 */
function imagePreview(items, max = 5, meta = {}) {
  if (!items || items.length === 0) return 'Tidak ada gambar untuk ditampilkan.';
  let text = buildHeader('🖼️ *Image Results*', items, meta);

  items.slice(0, max).forEach((img, i) => {
    text += `${i + 1}. *${truncate(img.title || 'Image', 50)}*\n`;
    const metaParts = [];
    if (img.width && img.height) metaParts.push(`📐 ${img.width}×${img.height}`);
    if (img.photographer) metaParts.push(`📷 ${img.photographer}`);
    if (metaParts.length) text += `   ${metaParts.join(' | ')}\n`;
    if (img.url) text += `   🔗 ${img.url}\n`;
    text += '\n';
  });

  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text.trim();
}

/**
 * Format paper results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @param {Object} [meta]
 * @returns {string}
 */
function paperPreview(items, max = 5, meta = {}) {
  if (!items || items.length === 0) return 'Tidak ada paper untuk ditampilkan.';
  let text = buildHeader('📄 *Paper Results*', items, meta);

  items.slice(0, max).forEach((paper, i) => {
    text += `${i + 1}. *${truncate(paper.title || 'Untitled', 60)}*\n`;
    if (paper.authors) text += `   👤 ${truncate(paper.authors, 50)}\n`;
    const metaParts = [];
    if (paper.year) metaParts.push(`📅 ${paper.year}`);
    if (paper.citationCount != null) metaParts.push(`📊 ${paper.citationCount} cit.`);
    if (paper.isOpenAccess) metaParts.push('🔓 OA');
    if (metaParts.length) text += `   ${metaParts.join(' | ')}\n`;
    if (paper.pdfUrl) text += `   📥 ${paper.pdfUrl}\n`;
    else if (paper.url) text += `   🔗 ${paper.url}\n`;
    text += '\n';
  });

  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text.trim();
}

/**
 * Format dataset results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @param {Object} [meta]
 * @returns {string}
 */
function datasetPreview(items, max = 5, meta = {}) {
  if (!items || items.length === 0) return 'Tidak ada dataset untuk ditampilkan.';
  let text = buildHeader('📊 *Dataset Results*', items, meta);

  items.slice(0, max).forEach((ds, i) => {
    text += `${i + 1}. *${truncate(ds.title || 'Untitled', 60)}*\n`;
    const metaParts = [];
    if (ds.author) metaParts.push(`👤 ${ds.author}`);
    if (ds.size) metaParts.push(`💾 ${ds.size}`);
    if (ds.downloads != null) metaParts.push(`⬇️ ${ds.downloads}`);
    if (metaParts.length) text += `   ${metaParts.join(' | ')}\n`;
    if (ds.url) text += `   🔗 ${ds.url}\n`;
    text += '\n';
  });

  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text.trim();
}

/**
 * Format code/repository results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @param {Object} [meta]
 * @returns {string}
 */
function codePreview(items, max = 5, meta = {}) {
  if (!items || items.length === 0) return 'Tidak ada repositori kode untuk ditampilkan.';
  let text = buildHeader('💻 *Code & Repositories*', items, meta);

  items.slice(0, max).forEach((code, i) => {
    text += `${i + 1}. *${truncate(code.title || code.name || 'Untitled Repo', 60)}*\n`;
    const metaParts = [];
    if (code.stars != null) metaParts.push(`⭐ ${code.stars}`);
    if (code.forks != null) metaParts.push(`🍴 ${code.forks}`);
    if (code.language) metaParts.push(`💻 ${code.language}`);
    if (code.license && code.license !== 'No License') metaParts.push(`📜 ${code.license}`);
    if (metaParts.length) text += `   ${metaParts.join(' | ')}\n`;
    if (code.description) text += `   📝 ${truncate(code.description, 90)}\n`;
    if (code.url) text += `   🔗 ${code.url}\n`;
    text += '\n';
  });

  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text.trim();
}

/**
 * Format book results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @param {Object} [meta]
 * @returns {string}
 */
function bookPreview(items, max = 5, meta = {}) {
  if (!items || items.length === 0) return 'Tidak ada buku untuk ditampilkan.';
  let text = buildHeader('📚 *Books & Literature*', items, meta);

  items.slice(0, max).forEach((book, i) => {
    text += `${i + 1}. *${truncate(book.title || 'Untitled Book', 60)}*\n`;
    const metaParts = [];
    const author = book.authors || book.author;
    if (author) metaParts.push(`✍️ ${truncate(author, 40)}`);
    if (book.year || book.publishedYear || book.firstPublishYear) {
      metaParts.push(`📅 ${book.year || book.publishedYear || book.firstPublishYear}`);
    }
    if (book.downloads != null) metaParts.push(`⬇️ ${book.downloads}`);
    if (metaParts.length) text += `   ${metaParts.join(' | ')}\n`;
    const download = book.downloadUrl || book.textUrl || book.epubUrl;
    if (download) text += `   📥 ${download}\n`;
    else if (book.url) text += `   🔗 ${book.url}\n`;
    text += '\n';
  });

  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text.trim();
}

/**
 * Format forum/discussion results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @param {Object} [meta]
 * @returns {string}
 */
function forumPreview(items, max = 5, meta = {}) {
  if (!items || items.length === 0) return 'Tidak ada diskusi forum untuk ditampilkan.';
  let text = buildHeader('💬 *Forum & Discussions*', items, meta);

  items.slice(0, max).forEach((post, i) => {
    text += `${i + 1}. *${truncate(post.title || 'Untitled Discussion', 60)}*\n`;
    const metaParts = [];
    const points = post.points ?? post.score ?? post.upvotes;
    if (points != null) metaParts.push(`⬆️ ${points}`);
    const comments = post.comments ?? post.num_comments ?? post.answers;
    if (comments != null) metaParts.push(`💬 ${comments}`);
    const author = post.author ?? post.by;
    if (author) metaParts.push(`👤 ${author}`);
    if (metaParts.length) text += `   ${metaParts.join(' | ')}\n`;
    if (post.url) text += `   🔗 ${post.url}\n`;
    text += '\n';
  });

  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text.trim();
}

/**
 * Format general results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @param {Object} [meta]
 * @returns {string}
 */
function generalPreview(items, max = 5, meta = {}) {
  if (!items || items.length === 0) return 'Tidak ada hasil untuk ditampilkan.';
  let text = buildHeader('🔍 *Search Results*', items, meta);

  items.slice(0, max).forEach((item, i) => {
    text += `${i + 1}. *${truncate(item.title || 'Untitled', 60)}*\n`;
    if (item.description) text += `   ${truncate(item.description, 100)}\n`;
    if (item.url) text += `   🔗 ${item.url}\n`;
    text += '\n';
  });

  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text.trim();
}

/**
 * Auto-select preview formatter based on type.
 * @param {Object[]} items
 * @param {string} type - images | papers | datasets | code | books | forums | general
 * @param {number} [max=5]
 * @param {Object} [meta]
 * @returns {string}
 */
function formatPreview(items, type, max = 5, meta = {}) {
  switch (type) {
    case 'images': return imagePreview(items, max, meta);
    case 'papers': return paperPreview(items, max, meta);
    case 'datasets': return datasetPreview(items, max, meta);
    case 'code': return codePreview(items, max, meta);
    case 'books': return bookPreview(items, max, meta);
    case 'forums': return forumPreview(items, max, meta);
    default: return generalPreview(items, max, meta);
  }
}

module.exports = {
  imagePreview,
  paperPreview,
  datasetPreview,
  codePreview,
  bookPreview,
  forumPreview,
  generalPreview,
  formatPreview,
};

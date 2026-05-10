'use strict';

/**
 * @fileoverview Preview card templates — formatted result previews for WhatsApp.
 * @module bot/templates/previewCards
 */

const { truncate } = require('../../utils/text');

/**
 * Format image results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @returns {string}
 */
function imagePreview(items, max = 5) {
  let text = '🖼️ *Image Results:*\n\n';
  items.slice(0, max).forEach((img, i) => {
    text += `${i + 1}. *${truncate(img.title || 'Image', 50)}*\n`;
    if (img.width && img.height) text += `   📐 ${img.width}×${img.height}`;
    if (img.photographer) text += ` | 📷 ${img.photographer}`;
    text += '\n';
    if (img.url) text += `   🔗 ${img.url}\n`;
    text += '\n';
  });
  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text;
}

/**
 * Format paper results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @returns {string}
 */
function paperPreview(items, max = 5) {
  let text = '📄 *Paper Results:*\n\n';
  items.slice(0, max).forEach((paper, i) => {
    text += `${i + 1}. *${truncate(paper.title || 'Untitled', 60)}*\n`;
    if (paper.authors) text += `   👤 ${truncate(paper.authors, 50)}\n`;
    const meta = [];
    if (paper.year) meta.push(`📅 ${paper.year}`);
    if (paper.citationCount) meta.push(`📊 ${paper.citationCount} cit.`);
    if (paper.isOpenAccess) meta.push('🔓 OA');
    if (meta.length) text += `   ${meta.join(' | ')}\n`;
    if (paper.pdfUrl) text += `   📥 ${paper.pdfUrl}\n`;
    else if (paper.url) text += `   🔗 ${paper.url}\n`;
    text += '\n';
  });
  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text;
}

/**
 * Format dataset results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @returns {string}
 */
function datasetPreview(items, max = 5) {
  let text = '📊 *Dataset Results:*\n\n';
  items.slice(0, max).forEach((ds, i) => {
    text += `${i + 1}. *${truncate(ds.title || 'Untitled', 60)}*\n`;
    const meta = [];
    if (ds.author) meta.push(`👤 ${ds.author}`);
    if (ds.size) meta.push(`💾 ${ds.size}`);
    if (ds.downloads) meta.push(`⬇️ ${ds.downloads}`);
    if (meta.length) text += `   ${meta.join(' | ')}\n`;
    if (ds.url) text += `   🔗 ${ds.url}\n`;
    text += '\n';
  });
  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text;
}

/**
 * Format general results as preview.
 * @param {Object[]} items
 * @param {number} [max=5]
 * @returns {string}
 */
function generalPreview(items, max = 5) {
  let text = '🔍 *Search Results:*\n\n';
  items.slice(0, max).forEach((item, i) => {
    text += `${i + 1}. *${truncate(item.title || 'Untitled', 60)}*\n`;
    if (item.description) text += `   ${truncate(item.description, 100)}\n`;
    if (item.url) text += `   🔗 ${item.url}\n`;
    text += '\n';
  });
  if (items.length > max) text += `... +${items.length - max} lainnya`;
  return text;
}

/**
 * Auto-select preview formatter based on type.
 * @param {Object[]} items
 * @param {string} type
 * @param {number} [max=5]
 * @returns {string}
 */
function formatPreview(items, type, max = 5) {
  switch (type) {
    case 'images': return imagePreview(items, max);
    case 'papers': return paperPreview(items, max);
    case 'datasets': return datasetPreview(items, max);
    default: return generalPreview(items, max);
  }
}

module.exports = { imagePreview, paperPreview, datasetPreview, generalPreview, formatPreview };

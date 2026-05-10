'use strict';

/**
 * @fileoverview Image service — download, convert, resize using sharp.
 * @module services/images/index
 */

const sharp = require('sharp');
const path = require('path');
const { get } = require('../../utils/httpClient');
const config = require('../../config');
const { ensureDir, writeFile } = require('../../utils/fsUtil');
const { createLogger } = require('../monitor/logger');

const log = createLogger('images');

/**
 * Download an image from URL.
 * @param {string} url - Image URL
 * @param {Object} [options]
 * @param {number} [options.timeout=30000]
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadImage(url, options = {}) {
  const response = await get(url, {
    responseType: 'arraybuffer',
    timeout: options.timeout || 30000,
  });
  return Buffer.from(response.data);
}

/**
 * Convert and optionally resize an image.
 * @param {Buffer} buffer - Image buffer
 * @param {Object} [options]
 * @param {string} [options.format='jpeg'] - Output format (jpeg|png|webp|avif)
 * @param {number} [options.width] - Target width
 * @param {number} [options.height] - Target height
 * @param {number} [options.quality=80] - Quality (1-100)
 * @returns {Promise<Buffer>} Converted image buffer
 */
async function convertImage(buffer, options = {}) {
  const { format = 'jpeg', width, height, quality = 80 } = options;

  let pipeline = sharp(buffer);

  if (width || height) {
    pipeline = pipeline.resize(width, height, { fit: 'inside', withoutEnlargement: true });
  }

  switch (format) {
    case 'png': pipeline = pipeline.png({ quality }); break;
    case 'webp': pipeline = pipeline.webp({ quality }); break;
    case 'avif': pipeline = pipeline.avif({ quality }); break;
    case 'jpeg':
    default: pipeline = pipeline.jpeg({ quality }); break;
  }

  return pipeline.toBuffer();
}

/**
 * Get image metadata (dimensions, format, size).
 * @param {Buffer} buffer
 * @returns {Promise<Object>}
 */
async function getMetadata(buffer) {
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    size: buffer.length,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
  };
}

/**
 * Create a thumbnail from image buffer.
 * @param {Buffer} buffer
 * @param {number} [size=200] - Max dimension
 * @returns {Promise<Buffer>} Thumbnail buffer
 */
async function createThumbnail(buffer, size = 200) {
  return sharp(buffer)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer();
}

/**
 * Download image from URL, convert, and save to disk.
 * @param {string} url - Image URL
 * @param {Object} [options]
 * @param {string} [options.format='jpeg']
 * @param {number} [options.width]
 * @param {number} [options.quality=80]
 * @param {string} [options.filename] - Custom filename
 * @returns {Promise<{ filepath: string, metadata: Object }>}
 */
async function downloadAndSave(url, options = {}) {
  const dir = config.dirs.outputs;
  await ensureDir(dir);

  const buffer = await downloadImage(url);
  const converted = await convertImage(buffer, options);
  const metadata = await getMetadata(converted);

  const ext = options.format || 'jpeg';
  const filename = options.filename || `img_${Date.now()}.${ext}`;
  const filepath = path.join(dir, filename);

  await writeFile(filepath, converted);
  log.debug(`Image saved: ${filename} (${metadata.width}x${metadata.height})`);

  return { filepath, metadata };
}

module.exports = { downloadImage, convertImage, getMetadata, createThumbnail, downloadAndSave };

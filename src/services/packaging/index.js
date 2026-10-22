'use strict';

/**
 * @fileoverview Packaging service — ZIP bundling with archiver.
 * @module services/packaging/index
 */

const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const config = require('../../config');
const { ensureDir } = require('../../utils/fsUtil');
const { formatAndSave } = require('../formatters');
const { createLogger } = require('../monitor/logger');

const log = createLogger('packaging');

/**
 * Create a ZIP archive from job results.
 * Exports results in multiple formats (JSON + CSV + TXT).
 * @param {Object} job - Job object
 * @param {string[]} [formats=['json','csv','txt']] - Formats to include
 * @returns {Promise<string>} Path to ZIP file
 */
async function createZipFromJob(job, formats = ['json', 'csv', 'txt']) {
  const dir = config.dirs.outputs;
  await ensureDir(dir);

  const keyword = (job.request.keyword || 'results').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const zipName = `${keyword}_${Date.now()}.zip`;
  const zipPath = path.join(dir, zipName);

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      log.info(`ZIP created: ${zipName} (${archive.pointer()} bytes)`);
      resolve(zipPath);
    });

    archive.on('error', (err) => {
      log.error('ZIP creation failed', { error: err.message });
      reject(err);
    });

    archive.pipe(output);

    (async () => {
      try {
        const meta = {
          keyword: job.request.keyword,
          providerUsed: job.result?.providerUsed,
        };

        for (const format of formats) {
          try {
            if (format === 'excel') {
              const filepath = await require('../formatters').toExcel(job.result.items, meta);
              archive.file(filepath, { name: path.basename(filepath) });
            } else {
              const { filepath } = await formatAndSave(job.result.items, format, meta);
              archive.file(filepath, { name: path.basename(filepath) });
            }
          } catch (err) {
            log.warn(`Format ${format} failed in ZIP`, { error: err.message });
          }
        }

        // Add job metadata as README
        const readme = [
          `Job: ${job.jobId}`,
          `Keyword: ${job.request.keyword}`,
          `Type: ${job.request.scrapeType}`,
          `Provider: ${job.result?.providerUsed || '-'}`,
          `Items: ${job.result?.itemCount || 0}`,
          `Created: ${job.createdAt}`,
          `Completed: ${job.completedAt}`,
        ].join('\n');

        archive.append(readme, { name: 'README.txt' });

        archive.finalize();
      } catch (err) {
        reject(err);
      }
    })();
  });
}

module.exports = { createZipFromJob };

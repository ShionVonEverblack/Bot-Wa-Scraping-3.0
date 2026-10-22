'use strict';

/**
 * @fileoverview Scrape job worker — executes scrapeEngine pipeline, formats output,
 * optional AI summary, and delivers results to WhatsApp chat.
 * @module jobs/jobWorker
 */

const scrapeEngine = require('../engine/scrapeEngine');
const { formatAndSave } = require('../services/formatters');
const { formatPreview } = require('../bot/templates/previewCards');
const { createLogger } = require('../services/monitor/logger');
const jobStore = require('./jobStore');
const { JOB_STATUS } = require('./jobSchemas');

const log = createLogger('jobs:worker');

/**
 * Process a SCRAPE job.
 * @param {Object} job - Job object
 * @param {Object} [client] - WhatsApp client
 * @param {AbortSignal} [signal] - Cancellation signal
 * @returns {Promise<Object>} Updated job object
 */
async function processScrapeJob(job, client, signal) {
  const { jobId, request } = job;

  await jobStore.updateJob(jobId, {
    status: JOB_STATUS.RUNNING,
    startedAt: new Date().toISOString(),
    progress: { percent: 20, message: `Scraping ${request.scrapeType} "${request.keyword}"...` },
  });

  const scrapeResult = await scrapeEngine.scrape({
    type: request.scrapeType || 'general',
    keyword: request.keyword,
    limit: request.limit || 10,
    page: request.page || 1,
    cursor: request.cursor || null,
    provider: request.provider || null,
    multi: !!request.multi,
    signal,
  });

  if (signal && signal.aborted) {
    return jobStore.updateJob(jobId, {
      status: JOB_STATUS.CANCELLED,
      completedAt: new Date().toISOString(),
      progress: { percent: 0, message: 'Cancelled' },
    });
  }

  const items = scrapeResult.items || [];
  const files = [];

  if (items.length > 0) {
    try {
      const { filepath } = await formatAndSave(items, request.format || 'json', {
        keyword: request.keyword,
        providerUsed: scrapeResult.providerUsed,
      });
      if (filepath) files.push(filepath);
    } catch (err) {
      log.warn(`Format output failed for job ${jobId}`, { error: err.message });
    }
  }

  const currentJob = await jobStore.getJob(jobId);
  if ((signal && signal.aborted) || currentJob?.status === JOB_STATUS.CANCELLED) {
    log.info(`Job ${jobId} was cancelled before completion, skipping delivery`);
    return currentJob || job;
  }

  const updatedJob = await jobStore.updateJob(jobId, {
    status: JOB_STATUS.COMPLETED,
    completedAt: new Date().toISOString(),
    progress: { percent: 100, message: 'Completed' },
    result: {
      items,
      itemCount: items.length,
      providerUsed: scrapeResult.providerUsed || 'none',
      files,
      meta: scrapeResult.meta || {},
    },
  });

  // Deliver to WhatsApp client if available
  if (client && request.chatId && typeof client.sendMessage === 'function') {
    const finalJob = await jobStore.getJob(jobId);
    if ((signal && signal.aborted) || finalJob?.status === JOB_STATUS.CANCELLED) {
      return updatedJob;
    }
    try {
      if (items.length === 0) {
        await client.sendMessage(
          request.chatId,
          `⚠️ Tidak ditemukan hasil untuk *${request.keyword}* (Job: \`${jobId}\`).`
        );
      } else {
        const preview = formatPreview(items, request.scrapeType, 5);
        await client.sendMessage(
          request.chatId,
          `✅ *Job \`${jobId}\` Selesai!* (${items.length} hasil via ${scrapeResult.providerUsed})\n\n${preview}`
        );

        // Optional AI summary
        if (request.useAI) {
          try {
            const aiService = require('../services/ai/aiService');
            const summary = await aiService.summarizeResults({
              type: request.scrapeType,
              items,
            });
            await client.sendMessage(
              request.chatId,
              `🤖 *Ringkasan AI (${request.keyword}):*\n\n${summary}`
            );
          } catch (aiErr) {
            log.warn('AI summary failed during job delivery', { error: aiErr.message });
          }
        }

        // Send formatted file if created
        if (files.length > 0) {
          try {
            const { MessageMedia } = require('whatsapp-web.js');
            const media = MessageMedia.fromFilePath(files[0]);
            await client.sendMessage(request.chatId, media, {
              caption: `📎 *${request.keyword}* (${items.length} items)`,
            });
          } catch (mediaErr) {
            log.debug('Could not send file media', { error: mediaErr.message });
          }
        }
      }
    } catch (sendErr) {
      log.warn(`Failed to deliver job ${jobId} message`, { error: sendErr.message });
    }
  }

  return updatedJob;
}

module.exports = {
  processScrapeJob,
};

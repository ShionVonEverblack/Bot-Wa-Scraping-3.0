'use strict';

/**
 * @fileoverview Status command handler.
 * Command: !status <jobId>
 * @module commands/handlers/status
 */

const { createLogger } = require('../../services/monitor/logger');
const { formatDuration } = require('../../utils/time');

const log = createLogger('cmd:status');

/**
 * Handle !status command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args
 */
async function handle(msg, args) {
  const jobId = args[0];

  if (!jobId) {
    await msg.reply('❓ *Gunakan:* `!status <jobId>`\n\nContoh: `!status JaB3xZ`');
    return;
  }

  try {
    const jobManager = require('../../jobs/jobManager');
    const job = await jobManager.getJobStatus(jobId);

    if (!job) {
      await msg.reply(`❌ Job \`${jobId}\` tidak ditemukan.`);
      return;
    }

    const statusEmoji = {
      PENDING: '⏳', RUNNING: '🔄', COMPLETED: '✅', FAILED: '❌', CANCELLED: '🚫',
    };

    const elapsed = job.startedAt
      ? formatDuration(new Date(job.completedAt || Date.now()) - new Date(job.startedAt))
      : '-';

    const response = [
      `${statusEmoji[job.status] || '❓'} *Job: ${job.jobId}*\n`,
      `📋 Status: *${job.status}*`,
      `📝 Keyword: ${job.request?.keyword || '-'}`,
      `📂 Type: ${job.request?.scrapeType || '-'}`,
      `⏱️ Durasi: ${elapsed}`,
      job.progress ? `📊 Progress: ${job.progress.message || job.progress.phase}` : '',
      job.result?.itemCount ? `📦 Hasil: ${job.result.itemCount} item` : '',
      job.result?.providerUsed ? `🔧 Provider: ${job.result.providerUsed}` : '',
      job.error ? `\n❌ Error: ${job.error}` : '',
    ].filter(Boolean).join('\n');

    await msg.reply(response);
  } catch (err) {
    log.error('Status command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'status', description: 'Check job status' };

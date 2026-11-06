'use strict';

/**
 * @fileoverview Next/Continue command — pagination for previous jobs.
 * Command: !next <jobId> [--page N]
 * @module commands/handlers/next
 */

const { createLogger } = require('../../services/monitor/logger');
const { truncate } = require('../../utils/text');

const log = createLogger('cmd:next');

/**
 * Handle !next command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args
 * @param {Object} client
 */
async function handle(msg, args, client) {
  const jobId = args[0];

  if (!jobId) {
    await msg.reply('❓ *Gunakan:* `!next <jobId>`\nContoh: `!next JaB3xZ`');
    return;
  }

  try {
    const jobStore = require('../../jobs/jobStore');
    const jobManager = require('../../jobs/jobManager');
    const originalJob = await jobStore.getJob(jobId);

    if (!originalJob) {
      await msg.reply(`❌ Job \`${jobId}\` tidak ditemukan.`);
      return;
    }

    if (originalJob.status !== 'COMPLETED') {
      await msg.reply(`⚠️ Job \`${jobId}\` belum selesai (status: ${originalJob.status}).`);
      return;
    }

    // Get next page
    const nextPage = (originalJob.request.page || 1) + 1;
    const nextCursor = originalJob.result?.meta?.nextCursor || null;

    const chat = typeof msg.getChat === 'function' ? await msg.getChat().catch(() => null) : null;
    const contact = typeof msg.getContact === 'function' ? await msg.getContact().catch(() => null) : null;
    const userId = contact?.id?._serialized || msg.author || msg.from;
    const chatId = chat?.id?._serialized || msg.from || userId;

    const newJob = await jobManager.createJob({
      request: {
        type: originalJob.type,
        keyword: originalJob.request?.keyword || '',
        scrapeType: originalJob.request?.scrapeType || 'general',
        limit: originalJob.request?.limit || 10,
        format: originalJob.request?.format || 'json',
        provider: originalJob.result?.providerUsed || originalJob.request?.provider,
        page: nextPage,
        cursor: nextCursor,
        chatId,
        userId,
      },
      client,
    });

    await msg.reply(`📄 *Halaman ${nextPage}* untuk "${truncate(originalJob.request.keyword, 30)}"...\n🆔 Job: \`${newJob.jobId}\``);
  } catch (err) {
    log.error('Next command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'next', description: 'Get next page of results' };

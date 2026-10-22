'use strict';

/**
 * @fileoverview Continue command — resume from a specific page.
 * Command: !continue <jobId> --page N
 * @module commands/handlers/continue
 */

const yargsParser = require('yargs-parser');
const { createLogger } = require('../../services/monitor/logger');
const { truncate } = require('../../utils/text');

const log = createLogger('cmd:continue');

async function handle(msg, args, client) {
  const parsed = yargsParser(args);
  const jobId = parsed._[0];
  const page = parseInt(parsed.page || parsed.p || '2', 10);

  if (!jobId) {
    await msg.reply('❓ *Gunakan:* `!continue <jobId> --page N`');
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

    const chat = await msg.getChat();
    const contact = await msg.getContact();

    const newJob = await jobManager.createJob({
      request: {
        type: originalJob.type,
        keyword: originalJob.request.keyword,
        scrapeType: originalJob.request.scrapeType,
        limit: originalJob.request.limit,
        format: originalJob.request.format,
        provider: originalJob.result?.providerUsed || originalJob.request.provider,
        page,
        chatId: chat.id._serialized,
        userId: contact.id._serialized,
      },
      client,
    });

    await msg.reply(`📄 *Halaman ${page}* — "${truncate(originalJob.request.keyword, 30)}"\n🆔 Job: \`${newJob.jobId}\``);
  } catch (err) {
    log.error('Continue command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'continue', description: 'Continue from specific page' };

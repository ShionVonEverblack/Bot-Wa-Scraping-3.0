'use strict';

/**
 * @fileoverview Compress command — ZIP job result files.
 * Command: !compress <jobId>
 * @module commands/handlers/compress
 */

const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:compress');

/**
 * Handle !compress command.
 * @param {Object} msg
 * @param {string[]} args
 * @param {Object} client
 */
async function handle(msg, args, client) {
  const jobId = args[0];

  if (!jobId) {
    await msg.reply('❓ *Gunakan:* `!compress <jobId>`');
    return;
  }

  try {
    const jobStore = require('../../jobs/jobStore');
    const job = await jobStore.getJob(jobId);

    if (!job) {
      await msg.reply(`❌ Job \`${jobId}\` tidak ditemukan.`);
      return;
    }

    if (!job.result?.items || job.result.items.length === 0) {
      await msg.reply(`⚠️ Job \`${jobId}\` tidak punya data.`);
      return;
    }

    await msg.reply('📦 Membuat ZIP file...');

    const { createZipFromJob } = require('../../services/packaging');
    const zipPath = await createZipFromJob(job);

    const { MessageMedia } = require('whatsapp-web.js');
    const media = MessageMedia.fromFilePath(zipPath);
    await client.sendMessage(msg.from, media, {
      caption: `📦 *${job.request.keyword}* — ZIP Archive`,
    });

    log.info(`ZIP sent for job ${jobId}`);
  } catch (err) {
    log.error('Compress command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'compress', description: 'Compress job results to ZIP' };

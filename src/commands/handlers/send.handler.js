'use strict';

/**
 * @fileoverview Send command — re-send job results in a different format.
 * Command: !send <jobId> [--format csv|excel|html|txt|sql]
 * @module commands/handlers/send
 */

const yargsParser = require('yargs-parser');
const { normalizeFormat } = require('../../utils/validators');
const { createLogger } = require('../../services/monitor/logger');
const { formatAndSave } = require('../../services/formatters');

const log = createLogger('cmd:send');

/**
 * Handle !send command.
 * @param {Object} msg
 * @param {string[]} args
 * @param {Object} client
 */
async function handle(msg, args, client) {
  const parsed = yargsParser(args);
  const jobId = parsed._[0];

  if (!jobId) {
    await msg.reply('❓ *Gunakan:* `!send <jobId> --format csv|excel|html|txt|sql`');
    return;
  }

  const format = normalizeFormat(parsed.format || parsed.f || 'json');

  try {
    const jobStore = require('../../jobs/jobStore');
    const job = await jobStore.getJob(jobId);

    if (!job) {
      await msg.reply(`❌ Job \`${jobId}\` tidak ditemukan.`);
      return;
    }

    if (!job.result?.items || job.result.items.length === 0) {
      await msg.reply(`⚠️ Job \`${jobId}\` tidak punya data hasil.`);
      return;
    }

    await msg.reply(`📤 Mengformat ${job.result.items.length} item ke ${format.toUpperCase()}...`);

    const { filepath } = await formatAndSave(job.result.items, format, {
      keyword: job.request.keyword,
      providerUsed: job.result.providerUsed,
    });

    // Send file
    const { MessageMedia } = require('whatsapp-web.js');
    const media = MessageMedia.fromFilePath(filepath);
    await client.sendMessage(msg.from, media, {
      caption: `📊 *${job.request.keyword}* — ${format.toUpperCase()} (${job.result.items.length} items)`,
    });

    log.info(`Sent ${format} for job ${jobId}`);
  } catch (err) {
    log.error('Send command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'send', description: 'Re-send job results in different format' };

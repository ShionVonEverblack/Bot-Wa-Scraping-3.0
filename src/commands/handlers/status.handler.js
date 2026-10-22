'use strict';

/**
 * @fileoverview Status command handler — uses rich job card template.
 * Command: !status <jobId>
 * @module commands/handlers/status
 */

const { createLogger } = require('../../services/monitor/logger');
const { formatJobCard } = require('../../bot/templates/jobCard');

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

    // Use the rich job card template
    let response = formatJobCard(job);

    // Add file delivery info
    if (job.result?.files && job.result.files.length > 0) {
      response += `\n📎 Files: ${job.result.files.length} file terkirim`;
    }

    // Add action hints based on status
    if (job.status === 'COMPLETED' && job.result?.itemCount > 0) {
      response += `\n\n💡 *Actions:*`;
      response += `\n\`!send ${jobId} --format excel\` — kirim ulang`;
      response += `\n\`!compress ${jobId}\` — download ZIP`;
      response += `\n\`!next ${jobId}\` — halaman berikutnya`;
    } else if (job.status === 'RUNNING') {
      response += `\n\n⏳ Job masih berjalan...`;
    }

    await msg.reply(response);
  } catch (err) {
    log.error('Status command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'status', description: 'Check job status' };


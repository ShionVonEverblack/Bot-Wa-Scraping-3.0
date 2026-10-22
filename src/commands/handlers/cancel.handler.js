'use strict';

/**
 * @fileoverview Cancel command handler.
 * Command: !cancel <jobId>
 * @module commands/handlers/cancel
 */

const { createLogger } = require('../../services/monitor/logger');
const log = createLogger('cmd:cancel');

/**
 * Handle !cancel command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args
 */
async function handle(msg, args) {
  const jobId = args[0];

  if (!jobId) {
    await msg.reply('❓ *Gunakan:* `!cancel <jobId>`');
    return;
  }

  try {
    const jobManager = require('../../jobs/jobManager');
    const job = await jobManager.cancelJob(jobId);

    if (!job) {
      await msg.reply(`❌ Job \`${jobId}\` tidak ditemukan.`);
      return;
    }

    await msg.reply(`🚫 Job \`${jobId}\` dibatalkan.`);
  } catch (err) {
    log.error('Cancel command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'cancel', description: 'Cancel a running job' };

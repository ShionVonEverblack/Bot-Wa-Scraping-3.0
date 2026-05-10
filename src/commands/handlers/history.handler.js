'use strict';

/**
 * @fileoverview History command handler — shows recent job history.
 * Command: !history
 * @module commands/handlers/history
 */

const { createLogger } = require('../../services/monitor/logger');
const { truncate } = require('../../utils/text');
const { formatDuration } = require('../../utils/time');

const log = createLogger('cmd:history');

/**
 * Handle !history command.
 * @param {Object} msg - WhatsApp message
 */
async function handle(msg) {
  try {
    const contact = await msg.getContact();
    const userId = contact.id._serialized;
    const jobStore = require('../../jobs/jobStore');

    const jobs = await jobStore.listJobs({ userId, limit: 10 });

    if (jobs.length === 0) {
      await msg.reply('📋 Belum ada riwayat job.');
      return;
    }

    const statusEmoji = {
      PENDING: '⏳', RUNNING: '🔄', COMPLETED: '✅', FAILED: '❌', CANCELLED: '🚫',
    };

    let response = '📋 *Riwayat Job Terbaru:*\n\n';

    jobs.forEach((job, i) => {
      const emoji = statusEmoji[job.status] || '❓';
      const keyword = truncate(job.request?.keyword || '-', 25);
      const items = job.result?.itemCount || 0;
      response += `${i + 1}. ${emoji} \`${job.jobId}\` — ${keyword}`;
      if (items > 0) response += ` (${items} items)`;
      response += '\n';
    });

    response += '\nKetik `!status <jobId>` untuk detail.';
    await msg.reply(response);
  } catch (err) {
    log.error('History command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'history', description: 'Show job history' };

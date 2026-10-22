'use strict';

/**
 * @fileoverview Paper download command handler.
 * Command: !paper <DOI/arXiv/PMID/URL>
 * @module commands/handlers/paper
 */

const { createLogger } = require('../../services/monitor/logger');
const log = createLogger('cmd:paper');

/**
 * Handle !paper command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args
 * @param {Object} client
 */
async function handle(msg, args, client) {
  const identifier = args.join(' ').trim();

  if (!identifier) {
    await msg.reply([
      '📄 *Gunakan:* `!paper <identifier>`\n',
      '*Contoh:*',
      '`!paper 10.1038/s41586-020-2649-2`',
      '`!paper 2301.07041`',
      '`!paper PMID:12345678`',
    ].join('\n'));
    return;
  }

  try {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const jobManager = require('../../jobs/jobManager');

    const job = await jobManager.createJob({
      request: {
        type: 'DOWNLOAD_PAPER',
        identifier,
        chatId: chat.id._serialized,
        userId: contact.id._serialized,
      },
      client,
    });

    await msg.reply(`📄 *Mencari paper...*\n🆔 Job: \`${job.jobId}\`\n\nMencoba resolver: Unpaywall → OpenAlex → arXiv → Crossref`);
  } catch (err) {
    log.error('Paper command failed', { error: err.message });
    await msg.reply(`❌ Gagal: ${err.message}`);
  }
}

module.exports = { handle, command: 'paper', description: 'Download a paper PDF' };

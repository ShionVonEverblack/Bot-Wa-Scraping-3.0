'use strict';

/**
 * @fileoverview Scrape command handler.
 * Command: !scrape <keyword> [--type images|papers|datasets|general] [--format json|csv|excel] [--limit N]
 * @module commands/handlers/scrape
 */

const yargsParser = require('yargs-parser');
const { normalizeType, normalizeFormat, parseLimit } = require('../../utils/validators');
const config = require('../../config');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:scrape');

/**
 * Handle !scrape command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 * @param {Object} client - WhatsApp client
 */
async function handle(msg, args, client) {
  const parsed = yargsParser(args);
  const keyword = parsed._.join(' ').trim();

  if (!keyword) {
    await msg.reply([
      '❌ *Keyword diperlukan!*',
      '',
      '*Penggunaan:*',
      '`!scrape <keyword> [options]`',
      '',
      '*Contoh:*',
      '`!scrape machine learning --type papers`',
      '`!scrape kucing lucu --type images --limit 20`',
      '`!scrape covid dataset --type datasets`',
    ].join('\n'));
    return;
  }

  const type = normalizeType(parsed.type || parsed.t);
  const format = normalizeFormat(parsed.format || parsed.f);
  const limit = parseLimit(parsed.limit || parsed.l);
  const provider = parsed.provider || parsed.p || null;

  const chat = await msg.getChat();
  const contact = await msg.getContact();
  const userId = contact.id._serialized;

  const typeEmoji = { images: '🖼️', papers: '📄', datasets: '📊', general: '🔍' };

  try {
    const jobManager = require('../../jobs/jobManager');

    const job = await jobManager.createJob({
      request: {
        type: 'SCRAPE',
        keyword,
        scrapeType: type,
        limit,
        format,
        provider,
        chatId: chat.id._serialized,
        userId,
      },
      client,
    });

    // Update context
    try {
      const contextMemory = require('../../bot/nlp/contextMemory');
      contextMemory.store(userId, {
        lastKeyword: keyword,
        lastType: type,
        lastJobId: job.jobId,
        lastIntent: 'SCRAPE',
      });
    } catch { /* ignore */ }

    await msg.reply([
      `${typeEmoji[type] || '🔍'} *Pencarian Dimulai*`,
      `Topik: *${keyword}*`,
      `Status: ⏳ Sedang memproses... (\`!status ${job.jobId}\`)`,
    ].join('\n'));
  } catch (err) {
    log.error('Scrape command failed', { error: err.message });
    if (err.code === 'ACCESS_DENIED') {
      await msg.reply('🚫 Akses ditolak.');
    } else {
      await msg.reply(`❌ Gagal membuat job: ${err.message}`);
    }
  }
}

module.exports = { handle, command: 'scrape', description: 'Search and scrape data' };

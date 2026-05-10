'use strict';

/**
 * @fileoverview AI chat command handler.
 * Command: !ai <question>
 * @module commands/handlers/ai
 */

const { createLogger } = require('../../services/monitor/logger');
const { truncate } = require('../../utils/text');

const log = createLogger('cmd:ai');

/**
 * Handle !ai command.
 * @param {Object} msg - WhatsApp message
 * @param {string[]} args - Command arguments
 */
async function handle(msg, args) {
  const question = args.join(' ').trim();

  if (!question) {
    await msg.reply('❓ *Mau tanya apa?*\n\nContoh:\n`!ai apa itu machine learning?`\n`!ai jelaskan quantum computing`');
    return;
  }

  try {
    await msg.reply('🤔 Sedang berpikir...');

    const aiService = require('../../services/ai/aiService');
    const response = await aiService.chat(question);

    await msg.reply(`🤖 *${truncate(question, 50)}*\n\n${response}`);
  } catch (err) {
    log.error('AI command failed', { error: err.message });
    await msg.reply('❌ AI sedang tidak tersedia. Coba lagi nanti.');
  }
}

module.exports = { handle, command: 'ai', description: 'Ask AI a question' };

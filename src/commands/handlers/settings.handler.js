'use strict';

/**
 * @fileoverview Settings command — show/change bot settings per user.
 * Command: !settings [key] [value]
 * @module commands/handlers/settings
 */

const config = require('../../config');

async function handle(msg, args) {
  if (args.length === 0) {
    const response = [
      '⚙️ *Bot Settings:*\n',
      `🤖 Bot: *${config.botName}*`,
      `🧠 AI Provider: *${config.ai.provider}*`,
      `📊 Default Limit: ${config.limits.resultLimitDefault}`,
      `📄 Default Format: ${config.output.formatDefault}`,
      `⏳ Cooldown: ${config.limits.userCooldownMs / 1000}s`,
      `🔄 Max Concurrency: ${config.limits.maxConcurrency}`,
      `🌐 Wikipedia Lang: ${config.providers.wikipediaLang || 'en'}`,
      '',
      '💡 Settings ini di-manage via `.env` file.',
    ].join('\n');
    await msg.reply(response);
    return;
  }

  await msg.reply('⚙️ Settings hanya bisa diubah via file `.env` lalu restart bot.');
}

module.exports = { handle, command: 'settings', description: 'View bot settings' };

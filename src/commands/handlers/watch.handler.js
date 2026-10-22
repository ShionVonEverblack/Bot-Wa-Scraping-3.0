'use strict';

/**
 * @fileoverview Watch command — create scheduled recurring scrapes.
 * Command: !watch <keyword> [--type papers] [--every daily|hourly|weekly|3h]
 * @module commands/handlers/watch
 */

const yargsParser = require('yargs-parser');
const { normalizeType } = require('../../utils/validators');
const { createLogger } = require('../../services/monitor/logger');

const log = createLogger('cmd:watch');

async function handle(msg, args, client) {
  const parsed = yargsParser(args);
  const keyword = parsed._.join(' ').trim();

  if (!keyword) {
    await msg.reply([
      '⏰ *Gunakan:* `!watch <keyword> [options]`\n',
      '*Options:*',
      '`--type images|papers|datasets|general`',
      '`--every hourly|daily|weekly|3h|6h|12h`',
      '`--limit N`\n',
      '*Contoh:*',
      '`!watch machine learning --type papers --every daily`',
      '`!watch bitcoin price --every 3h`',
    ].join('\n'));
    return;
  }

  try {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const watchService = require('../../services/watch');

    const watch = await watchService.createWatch({
      keyword,
      type: normalizeType(parsed.type || parsed.t),
      limit: parseInt(parsed.limit || parsed.l, 10) || 10,
      schedule: parsed.every || parsed.e || 'daily',
      chatId: chat.id._serialized,
      userId: contact.id._serialized,
    }, client);

    await msg.reply([
      `⏰ *Watch Created!*\n`,
      `🆔 Watch: \`${watch.watchId}\``,
      `📝 Keyword: *${keyword}*`,
      `📂 Type: ${watch.type}`,
      `🔄 Schedule: \`${watch.schedule}\` (${parsed.every || 'daily'})`,
      `\n💡 Kelola: \`!watches\` | \`!unwatch ${watch.watchId}\``,
    ].join('\n'));
  } catch (err) {
    log.error('Watch command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'watch', description: 'Create scheduled watch' };

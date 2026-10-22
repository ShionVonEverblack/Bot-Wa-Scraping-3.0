'use strict';

/**
 * @fileoverview Unwatch command — remove a scheduled watch.
 * Command: !unwatch <watchId>
 * @module commands/handlers/unwatch
 */

const { createLogger } = require('../../services/monitor/logger');
const log = createLogger('cmd:unwatch');

async function handle(msg, args) {
  const watchId = args[0];
  if (!watchId) {
    await msg.reply('❓ *Gunakan:* `!unwatch <watchId>`\nLihat daftar: `!watches`');
    return;
  }

  try {
    const watchService = require('../../services/watch');
    const removed = await watchService.removeWatch(watchId);

    if (removed) {
      await msg.reply(`✅ Watch \`${watchId}\` dihapus.`);
    } else {
      await msg.reply(`❌ Watch \`${watchId}\` tidak ditemukan.`);
    }
  } catch (err) {
    log.error('Unwatch command failed', { error: err.message });
    await msg.reply(`❌ Error: ${err.message}`);
  }
}

module.exports = { handle, command: 'unwatch', description: 'Remove a watch' };
